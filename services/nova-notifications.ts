import type { HouseholdSnapshot, Itinerary, NotificationItem, NovaNotificationPrefs } from '@/types/orbit';

export type { NovaNotificationPrefs };

export const DEFAULT_NOVA_NOTIFICATION_PREFS: NovaNotificationPrefs = {
  tasks: true,
  itinerary: true,
  groceries: true,
  rewards: true,
};

type PushFn = (input: {
  title: string;
  body: string;
  category: NotificationItem['category'];
  priority?: NotificationItem['priority'];
  data?: Record<string, unknown>;
}) => Promise<NotificationItem | null>;

/** Quiet hours stub — suppress child spam when school window labels are present. */
export function isQuietHoursForChildren(household: HouseholdSnapshot, now = new Date()): boolean {
  const hour = now.getHours();
  const hasSchoolToday = household.events.some(
    (event) => event.category === 'School' && /today/i.test(event.date)
  );
  return hasSchoolToday && hour >= 8 && hour < 15;
}

export const novaNotifications = {
  async taskCompleted(
    push: PushFn,
    prefs: NovaNotificationPrefs,
    input: { title: string; assignee: string; awardedXp: number; penalty: number; late: boolean; taskId: string }
  ) {
    if (!prefs.tasks) return null;
    const body = input.late
      ? `${input.assignee} finished late · +${input.awardedXp} XP (−${input.penalty} late).`
      : `${input.assignee} finished · +${input.awardedXp} XP.`;
    return push({
      title: `Nova · ${input.title}`,
      body,
      category: 'ai',
      priority: input.late ? 'high' : 'medium',
      data: { taskId: input.taskId, kind: 'task_completed' },
    });
  },

  async taskOverdue(push: PushFn, prefs: NovaNotificationPrefs, input: { title: string; assignee: string; taskId: string }) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Nova · Task is late',
      body: `${input.title} for ${input.assignee} is overdue. Want me to nudge or reassign?`,
      category: 'ai',
      priority: 'high',
      data: { taskId: input.taskId, kind: 'task_overdue' },
    });
  },

  async proofSubmitted(push: PushFn, prefs: NovaNotificationPrefs, input: { title: string; assignee: string; taskId: string }) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Nova · Proof ready to review',
      body: `${input.assignee} attached proof for ${input.title}.`,
      category: 'ai',
      priority: 'medium',
      data: { taskId: input.taskId, kind: 'proof_submitted' },
    });
  },

  async itineraryNextLeg(
    push: PushFn,
    prefs: NovaNotificationPrefs,
    input: { itinerary: Itinerary; stopLabel: string; nextLabel?: string }
  ) {
    if (!prefs.itinerary) return null;
    const body = input.nextLabel
      ? `Arrived at ${input.stopLabel}. Next: ${input.nextLabel}. Opening Maps when you are ready.`
      : `Arrived at ${input.stopLabel}. ${input.itinerary.title} is complete.`;
    return push({
      title: `Nova · ${input.itinerary.title}`,
      body,
      category: 'ai',
      priority: 'medium',
      data: { itineraryId: input.itinerary.id, kind: 'itinerary_leg' },
    });
  },

  async groceryAdded(push: PushFn, prefs: NovaNotificationPrefs, input: { name: string; onSale: boolean; groceryId: string }) {
    if (!prefs.groceries) return null;
    return push({
      title: input.onSale ? 'Nova · On sale opportunity' : 'Nova · Cart updated',
      body: input.onSale
        ? `${input.name} is on sale — worth grabbing on the next store stop.`
        : `${input.name} was added to the shopping list.`,
      category: 'ai',
      priority: input.onSale ? 'medium' : 'low',
      data: { groceryId: input.groceryId, kind: 'grocery_added' },
    });
  },

  async rewardRequested(push: PushFn, prefs: NovaNotificationPrefs, input: { title: string; memberName: string; redemptionId: string }) {
    if (!prefs.rewards) return null;
    return push({
      title: 'Nova · Reward request',
      body: `${input.memberName} requested ${input.title}. Approve when it feels fair.`,
      category: 'ai',
      priority: 'medium',
      data: { redemptionId: input.redemptionId, kind: 'reward_requested' },
    });
  },

  async rewardApproved(push: PushFn, prefs: NovaNotificationPrefs, input: { title: string; redemptionId: string }) {
    if (!prefs.rewards) return null;
    return push({
      title: 'Nova · Reward approved',
      body: `${input.title} is good to go. Enjoy it.`,
      category: 'ai',
      priority: 'medium',
      data: { redemptionId: input.redemptionId, kind: 'reward_approved' },
    });
  },

  async streakAtRisk(push: PushFn, prefs: NovaNotificationPrefs, input: { memberName: string; streak: number }) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Nova · Streak check',
      body: `${input.memberName}'s ${input.streak}-day streak is at risk today. One small task keeps it alive.`,
      category: 'ai',
      priority: 'medium',
      data: { kind: 'streak_risk' },
    });
  },

  async joinPending(push: PushFn, input: { memberName: string; inviteCode: string }) {
    return push({
      title: 'Nova · Someone wants in',
      body: `${input.memberName} requested access with ${input.inviteCode}. Review in Members.`,
      category: 'ai',
      priority: 'high',
      data: { kind: 'join_pending' },
    });
  },
};
