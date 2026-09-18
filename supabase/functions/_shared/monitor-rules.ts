/**
 * Deterministic household monitor rules (port of services/poppins-monitor.ts).
 * No network. All current rules are templatable — model only if needsProse later.
 */

export type MonitorRuleKind = 'fairness' | 'deals' | 'plan' | 'streak';

export type FiredMonitorRule = {
  kind: MonitorRuleKind;
  needsProse: boolean;
  title: string;
  detail: string;
  tone: string;
  data?: Record<string, unknown>;
};

type MemberLike = {
  id?: string;
  name?: string;
  status?: string;
  streak?: number;
  awayFrom?: string;
  awayTo?: string;
  role?: string;
};

type TaskLike = {
  status?: string;
  assignee?: string;
  due?: string;
  title?: string;
};

type GroceryLike = { name?: string; status?: string };
type EventLike = { title?: string };

function isAway(member: MemberLike, now: Date) {
  if (!member.awayFrom || !member.awayTo) return false;
  const t = now.toISOString().slice(0, 10);
  return t >= member.awayFrom && t <= member.awayTo;
}

function prefsEnabled(
  prefs: Record<string, unknown> | undefined,
  key: string
): boolean {
  if (!prefs) return true;
  return prefs[key] !== false;
}

/**
 * Port of runMonitorPass — templatable recommendations only.
 */
export function evaluateHouseholdRules(
  household: Record<string, unknown>,
  metrics: Record<string, unknown>
): FiredMonitorRule[] {
  const fired: FiredMonitorRule[] = [];
  const now = new Date();
  const prefs = (household.notificationPrefs ?? household.notification_prefs ?? {}) as Record<
    string,
    unknown
  >;
  const members = (Array.isArray(household.members) ? household.members : []) as MemberLike[];
  const tasks = (Array.isArray(household.tasks) ? household.tasks : []) as TaskLike[];
  const groceries = (Array.isArray(household.groceries) ? household.groceries : []) as GroceryLike[];
  const events = (Array.isArray(household.events) ? household.events : []) as EventLike[];

  const awayNames = new Set(
    members.filter((m) => isAway(m, now)).map((m) => String(m.name ?? '').toLowerCase())
  );

  const momentum = Number(metrics.momentum ?? 100);
  if (prefsEnabled(prefs, 'xpFairness') && momentum < 40) {
    fired.push({
      kind: 'fairness',
      needsProse: false,
      title: 'Balance the load',
      detail: 'Some helpers may need lighter or clearer tasks this week.',
      tone: 'amber',
    });
  }

  if (prefsEnabled(prefs, 'deals')) {
    const needs = groceries
      .filter((g) => g.status === 'Missing' || g.status === 'Low' || g.status === 'missing')
      .map((g) => String(g.name ?? '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (needs.length) {
      fired.push({
        kind: 'deals',
        needsProse: false,
        title: 'Still on the list',
        detail: needs.join(' · '),
        tone: 'green',
        data: { names: needs },
      });
    }
  }

  if (prefsEnabled(prefs, 'plans') && events.length === 0) {
    fired.push({
      kind: 'plan',
      needsProse: false,
      title: 'Add something to Plan',
      detail: 'A school run or appointment keeps the week visible.',
      tone: 'cyan',
    });
  }

  if (prefsEnabled(prefs, 'tasks')) {
    for (const member of members.filter((m) => m.status === 'active' && (m.streak ?? 0) >= 3)) {
      const name = String(member.name ?? '');
      if (!name || awayNames.has(name.toLowerCase())) continue;
      const completedToday = tasks.some(
        (t) =>
          (t.status === 'Completed' || t.status === 'completed') &&
          t.assignee === name &&
          /completed today|today/i.test(String(t.due ?? ''))
      );
      if (completedToday) continue;
      const streak = member.streak ?? 0;
      fired.push({
        kind: 'streak',
        needsProse: false,
        title: 'Streak at risk',
        detail: `${name}'s ${streak}-day streak needs a win today.`,
        tone: 'amber',
        data: { memberId: member.id, name, streak },
      });
    }
  }

  return fired;
}

export function applyTemplates(rules: FiredMonitorRule[]) {
  return rules.map((rule) => ({
    kind: rule.kind,
    label: rule.title,
    detail: rule.detail,
    data: { ...(rule.data ?? {}), tone: rule.tone, needsProse: rule.needsProse },
  }));
}

/** Active window: local hour matches one of four daily slots. */
export function withinActiveWindow(
  timezone: string | null | undefined,
  activeHours: readonly number[],
  now = new Date()
): boolean {
  const tz = timezone?.trim() || 'America/Toronto';
  let hour: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    hour = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getUTCHours());
    // Some engines emit "24" for midnight
    if (hour === 24) hour = 0;
  } catch {
    hour = now.getUTCHours();
  }
  return activeHours.includes(hour);
}
