import { scanDealsForHousehold } from '@/data/mock-deals';
import {
  formatNotificationBody,
  getNotification,
} from '@/constants/notifications';
import type {
  HouseholdSnapshot,
  PoppinsMonitorAction,
  PoppinsNotificationPrefs,
  PoppinsRecommendation,
  OrbitMetrics,
} from '@/types/orbit';

export type MonitorPassResult = {
  actions: PoppinsMonitorAction[];
  recommendations: PoppinsRecommendation[];
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
 * Local Monitor pass — recommendations / Activity only.
 * Admin insights are composed separately (≤3/day, catalog + real shops).
 */
export function runMonitorPass(
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  prefs: PoppinsNotificationPrefs
): MonitorPassResult {
  const actions: PoppinsMonitorAction[] = [];
  const recommendations: PoppinsRecommendation[] = [];
  const notifications: MonitorPassResult['notifications'] = [];
  const now = new Date();

  const awayNames = new Set(
    household.members.filter((m) => isAway(m, now)).map((m) => m.name.toLowerCase())
  );

  if (prefs.xpFairness !== false && metrics.momentum < 40) {
    recommendations.push({
      id: `fairness-${now.toISOString()}`,
      title: 'Balance the load',
      detail: 'Some helpers may need lighter or clearer tasks this week.',
      tone: 'amber',
    });
  }

  if (prefs.deals !== false) {
    const needs = scanDealsForHousehold({
      groceryNames: household.groceries
        .filter((g) => g.status === 'Missing' || g.status === 'Low')
        .map((g) => g.name),
    }).slice(0, 3);
    if (needs.length) {
      const listed = needs
        .map((row) => (row.store ? `${row.title} (${row.store})` : row.title))
        .join(' · ');
      recommendations.push({
        id: `need-${needs.map((n) => n.id).join('-')}`,
        title: 'Still on the list',
        detail: listed,
        tone: 'green',
      });
    }
  }

  if (prefs.plans !== false && household.events.length === 0) {
    recommendations.push({
      id: `plan-${now.toISOString()}`,
      title: 'Add something to Plan',
      detail: 'A school run or appointment keeps the week visible.',
      tone: 'cyan',
    });
  }

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
      const def = getNotification('N23');
      recommendations.push({
        id: `streak-${member.id}`,
        title: def.title,
        detail: formatNotificationBody(def.body, {
          name: member.name,
          streak: member.streak ?? 0,
        }),
        tone: 'amber',
      });
    }
  }

  void actions;
  void notifications;
  return { actions, recommendations, notifications };
}
