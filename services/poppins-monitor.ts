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
 * Mock Monitor Agent pass — Rev E §2 closed registry only.
 * Recommendations may still surface in Poppins UI; unlisted pushes are gone.
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

  // Streak at risk → N23 (admin)
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
      notifications.push({
        title: def.title,
        body: formatNotificationBody(def.body, {
          name: member.name,
          streak: member.streak ?? 0,
        }),
        category: 'ai',
        priority: 'medium',
        data: { kind: 'streak_risk', notificationId: def.id, memberId: member.id },
      });
    }
  }

  // Fairness / deals / plan suggestions stay as in-app recommendations only (no push).
  if (prefs.xpFairness !== false && metrics.momentum < 40) {
    recommendations.push({
      id: `fairness-${now.toISOString()}`,
      title: 'Balance the load',
      detail: 'Some helpers may need lighter or clearer tasks this week.',
      tone: 'amber',
    });
  }

  if (prefs.deals !== false) {
    const deals = scanDealsForHousehold({
      groceryNames: household.groceries.map((g) => g.name),
    }).slice(0, 3);
    for (const deal of deals) {
      recommendations.push({
        id: `deal-${deal.id}`,
        title: deal.title,
        detail: `${deal.store} · save $${deal.savings}`,
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

  void actions;
  return { actions, recommendations, notifications };
}
