import { scanDealsForHousehold } from '@/data/mock-deals';
import type {
  HouseholdSnapshot,
  NovaMonitorAction,
  NovaNotificationPrefs,
  NovaRecommendation,
  OrbitMetrics,
} from '@/types/orbit';

export type MonitorPassResult = {
  actions: NovaMonitorAction[];
  recommendations: NovaRecommendation[];
  notifications: {
    title: string;
    body: string;
    category: 'ai';
    priority: 'low' | 'medium' | 'high';
    data?: Record<string, unknown>;
  }[];
};

function isAway(member: { awayFrom?: string; awayTo?: string }, now = new Date()) {
  if (!member.awayFrom || !member.awayTo) return false;
  const t = now.toISOString().slice(0, 10);
  return t >= member.awayFrom && t <= member.awayTo;
}

/**
 * Mock Monitor Agent pass — same checks the edge tool loop would run without OpenAI.
 * Creates notifications + recommendations only (propose, don't silently mutate).
 */
export function runMonitorPass(
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  prefs: NovaNotificationPrefs
): MonitorPassResult {
  const actions: NovaMonitorAction[] = [];
  const recommendations: NovaRecommendation[] = [];
  const notifications: MonitorPassResult['notifications'] = [];
  const now = new Date();

  const awayNames = new Set(
    household.members.filter((m) => isAway(m, now)).map((m) => m.name.toLowerCase())
  );

  // Overdue nudges
  if (prefs.tasks !== false) {
    const overdue = household.tasks.filter((t) => t.status === 'Overdue');
    for (const task of overdue.slice(0, 5)) {
      if (awayNames.has(task.assignee.toLowerCase())) continue;
      notifications.push({
        title: 'Nova · Task is late',
        body: `${task.title} for ${task.assignee} is overdue. Want me to nudge or reassign?`,
        category: 'ai',
        priority: 'high',
        data: { taskId: task.id, kind: 'task_overdue' },
      });
      actions.push({
        id: `overdue-${task.id}`,
        kind: 'nudge',
        label: `Nudged ${task.assignee}`,
        detail: task.title,
        createdAt: now.toISOString(),
      });
    }
  }

  // Streak at risk (no completed task today + streak > 0)
  if (prefs.tasks !== false) {
    for (const member of household.members.filter((m) => m.status === 'active' && (m.streak ?? 0) >= 3)) {
      if (awayNames.has(member.name.toLowerCase())) continue;
      const completedToday = household.tasks.some(
        (t) =>
          t.status === 'Completed' &&
          t.assignee === member.name &&
          /completed today|today/i.test(t.due)
      );
      if (completedToday) continue;
      notifications.push({
        title: 'Nova · Streak check',
        body: `${member.name}'s ${member.streak}-day streak is at risk today. One small task keeps it alive.`,
        category: 'ai',
        priority: 'medium',
        data: { kind: 'streak_risk', memberId: member.id },
      });
      actions.push({
        id: `streak-${member.id}`,
        kind: 'nudge',
        label: `Streak watch · ${member.name}`,
        detail: `${member.streak}-day streak at risk`,
        createdAt: now.toISOString(),
      });
    }
  }

  // XP fairness recommendation
  if (prefs.xpFairness !== false) {
    const active = household.members.filter((m) => m.status === 'active' && m.role !== 'guest');
    if (active.length >= 2) {
      const sorted = [...active].sort((a, b) => (b.weekXp ?? 0) - (a.weekXp ?? 0));
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      const gap = (top.weekXp ?? 0) - (bottom.weekXp ?? 0);
      if (gap >= 40) {
        const detail = `${top.name} earned ${top.weekXp ?? 0} XP this week vs ${bottom.name}'s ${bottom.weekXp ?? 0}. Consider lighter tasks for ${top.name} or more for ${bottom.name}.`;
        recommendations.push({
          id: 'xp-fairness',
          title: 'Balance weekly XP',
          detail,
          tone: 'amber',
        });
        actions.push({
          id: 'xp-fairness',
          kind: 'xp_fairness',
          label: 'Assessed XP fairness',
          detail,
          createdAt: now.toISOString(),
        });
        if (prefs.tasks !== false) {
          notifications.push({
            title: 'Nova · Fairness check',
            body: detail,
            category: 'ai',
            priority: 'medium',
            data: { kind: 'xp_fairness' },
          });
        }
      }
    }
  }

  // Deals scan
  if (prefs.deals !== false) {
    const groceryNames = household.groceries
      .filter((g) => g.status === 'Missing' || g.status === 'Low')
      .map((g) => g.name);
    const deals = scanDealsForHousehold({ groceryNames });
    if (deals.length > 0) {
      const top = deals.slice(0, 3);
      const body = top
        .map((d) => `${d.title} at ${d.store} (save $${d.savings})`)
        .join(' · ');
      notifications.push({
        title: `Nova · ${top.length} deal${top.length === 1 ? '' : 's'} found`,
        body,
        category: 'ai',
        priority: 'medium',
        data: { kind: 'deals', dealIds: top.map((d) => d.id) },
      });
      recommendations.push({
        id: 'deals-scan',
        title: 'Worth grabbing on the next run',
        detail: body,
        tone: 'green',
      });
      actions.push({
        id: `deals-${now.getTime()}`,
        kind: 'deals',
        label: `Found ${top.length} deals`,
        detail: body,
        createdAt: now.toISOString(),
      });
    }
  }

  // Plan proposal when momentum low or many overdue + missing groceries
  if (prefs.plans !== false) {
    const missing = household.groceries.filter((g) => g.status === 'Missing').length;
    const overdue = household.tasks.filter((t) => t.status === 'Overdue').length;
    if (missing >= 2 || overdue >= 1 || metrics.momentum < 50) {
      const title = 'Bundle errands into one trip';
      const detail =
        'Nova can fold school pickup, a short grocery stop, and one overdue errand into a single loop — saves the household lead a second drive.';
      recommendations.push({ id: 'propose-plan', title, detail, tone: 'cyan' });
      actions.push({
        id: `plan-${now.getTime()}`,
        kind: 'plan',
        label: 'Proposed Thursday loop',
        detail,
        createdAt: now.toISOString(),
      });
      notifications.push({
        title: 'Nova · Plan suggestion',
        body: detail,
        category: 'ai',
        priority: 'low',
        data: { kind: 'propose_plan' },
      });
    }
  }

  // Holidays awareness action (informational)
  const away = household.members.filter((m) => isAway(m, now));
  if (away.length > 0) {
    actions.push({
      id: 'holidays',
      kind: 'holiday',
      label: 'Holiday awareness',
      detail: `${away.map((m) => m.name).join(', ')} away — skipping nudges.`,
      createdAt: now.toISOString(),
    });
  }

  // Ask for info if calendar thin
  if (household.events.length < 2 && prefs.plans !== false) {
    const lead = household.members.find((m) => m.role === 'owner' || m.role === 'admin');
    if (lead && !awayNames.has(lead.name.toLowerCase())) {
      notifications.push({
        title: 'Nova needs a detail',
        body: `${lead.name}, can you add this week's pickups or appointments so I can plan better?`,
        category: 'ai',
        priority: 'low',
        data: { kind: 'ask_for_info', memberId: lead.id },
      });
      actions.push({
        id: 'ask-calendar',
        kind: 'ask_info',
        label: `Asked ${lead.name}`,
        detail: 'Need calendar coverage for the week',
        createdAt: now.toISOString(),
      });
    }
  }

  return { actions, recommendations, notifications };
}
