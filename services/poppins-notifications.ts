import type { HouseholdSnapshot, Itinerary, NotificationItem, PoppinsNotificationPrefs } from '@/types/orbit';
import {
  formatNotificationBody,
  getNotification,
  toSentenceValue,
} from '@/constants/notifications';

export type { PoppinsNotificationPrefs };

export const DEFAULT_POPPINS_NOTIFICATION_PREFS: PoppinsNotificationPrefs = {
  tasks: true,
  itinerary: true,
  groceries: true,
  rewards: true,
  deals: true,
  plans: true,
  xpFairness: true,
  nearShop: true,
  missingOnTheWay: true,
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

export const poppinsNotifications = {
  async taskCompleted(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; assignee: string; awardedXp: number; penalty: number; late: boolean; taskId: string }
  ) {
    if (!prefs.tasks) return null;
    const body = input.late
      ? `${input.assignee} finished late · +${input.awardedXp} XP (−${input.penalty} late).`
      : `${input.assignee} finished · +${input.awardedXp} XP.`;
    return push({
      title: `Poppins · ${input.title}`,
      body,
      category: 'ai',
      priority: input.late ? 'high' : 'medium',
      data: { taskId: input.taskId, kind: 'task_completed' },
    });
  },

  async taskOverdue(push: PushFn, prefs: PoppinsNotificationPrefs, input: { title: string; assignee: string; taskId: string }) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Poppins · Task is late',
      body: `${input.title} for ${input.assignee} is overdue. Want me to nudge or reassign?`,
      category: 'ai',
      priority: 'high',
      data: { taskId: input.taskId, kind: 'task_overdue' },
    });
  },

  async proofSubmitted(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; assignee: string; taskId: string; proofUri?: string; audienceRoles?: string[] }
  ) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Poppins · Proof ready to review',
      body: `${input.assignee} attached proof for ${input.title}. Open the task to approve.`,
      category: 'tasks',
      priority: 'high',
      data: {
        taskId: input.taskId,
        kind: 'proof_submitted',
        proofUri: input.proofUri,
        audienceRoles: input.audienceRoles ?? ['owner', 'admin', 'adult'],
      },
    });
  },

  async proofApproved(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; taskId: string; audienceRoles?: string[] }
  ) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Poppins · Proof approved',
      body: `Your proof for ${input.title} was approved. Nice verification.`,
      category: 'tasks',
      priority: 'medium',
      data: {
        taskId: input.taskId,
        kind: 'proof_approved',
        audienceRoles: input.audienceRoles,
      },
    });
  },

  async itineraryNextLeg(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { itinerary: Itinerary; stopLabel: string; nextLabel?: string }
  ) {
    if (!prefs.itinerary) return null;
    const body = input.nextLabel
      ? `Arrived at ${input.stopLabel}. Next: ${input.nextLabel}. Opening Maps when you are ready.`
      : `Arrived at ${input.stopLabel}. ${input.itinerary.title} is complete.`;
    return push({
      title: `Poppins · ${input.itinerary.title}`,
      body,
      category: 'ai',
      priority: 'medium',
      data: { itineraryId: input.itinerary.id, kind: 'itinerary_leg' },
    });
  },

  async groceryAdded(push: PushFn, prefs: PoppinsNotificationPrefs, input: { name: string; onSale: boolean; groceryId: string }) {
    if (!prefs.groceries) return null;
    return push({
      title: input.onSale ? 'Poppins · On sale opportunity' : 'Poppins · Cart updated',
      body: input.onSale
        ? `${input.name} is on sale — worth grabbing on the next store stop.`
        : `${input.name} was added to the shopping list.`,
      category: 'ai',
      priority: input.onSale ? 'medium' : 'low',
      data: { groceryId: input.groceryId, kind: 'grocery_added' },
    });
  },

  async rewardRequested(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      memberName: string;
      redemptionId: string;
      audienceRoles?: string[];
      /** True when asking for something not yet in the catalogue (N27). */
      isNewAsk?: boolean;
    }
  ) {
    if (!prefs.rewards) return null;
    const def = getNotification(input.isNewAsk ? 'N27' : 'N26');
    const body = formatNotificationBody(def.body, {
      name: input.memberName,
      reward: input.title,
      detail: input.title,
    });
    return push({
      title: def.title,
      body,
      category: 'rewards',
      priority: 'medium',
      data: {
        redemptionId: input.redemptionId,
        kind: 'reward_requested',
        notificationId: def.id,
        audienceRoles: input.audienceRoles ?? ['owner', 'admin', 'adult'],
      },
    });
  },

  async rewardClaimed(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; memberName: string; cost: number; redemptionId: string; audienceRoles?: string[] }
  ) {
    if (!prefs.rewards) return null;
    return push({
      title: 'Poppins · Reward claimed',
      body: `${input.memberName} claimed ${input.title} for ${input.cost} XP.`,
      category: 'rewards',
      priority: 'medium',
      data: {
        redemptionId: input.redemptionId,
        kind: 'reward_claimed',
        audienceRoles: input.audienceRoles ?? ['owner', 'admin', 'adult'],
      },
    });
  },

  async rewardApproved(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; redemptionId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.rewards) return null;
    return push({
      title: 'Poppins · Reward approved',
      body: `${input.title} is good to go. Enjoy it.`,
      category: 'rewards',
      priority: 'medium',
      data: {
        redemptionId: input.redemptionId,
        kind: 'reward_approved',
        audienceMemberIds: input.audienceMemberIds,
      },
    });
  },

  async rewardAssigned(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      cost: number;
      rewardId: string;
      assignedByName: string;
      audienceMemberIds: string[];
    }
  ) {
    if (!prefs.rewards) return null;
    return push({
      title: 'Poppins · Reward assigned',
      body: `${input.assignedByName} added "${input.title}" for you. Open Ranks → Rewards when ready.`,
      category: 'rewards',
      priority: 'medium',
      data: {
        rewardId: input.rewardId,
        kind: 'reward_assigned',
        audienceMemberIds: input.audienceMemberIds,
      },
    });
  },

  async allowanceRequested(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { amountLabel: string; memberName: string; allowanceId: string }
  ) {
    if (!prefs.rewards) return null;
    return push({
      title: 'Poppins · Allowance',
      body: `${input.memberName} asked for ${toSentenceValue(input.amountLabel)}.`,
      category: 'rewards',
      priority: 'medium',
      data: {
        allowanceId: input.allowanceId,
        kind: 'allowance_requested',
        audienceRoles: ['owner', 'admin', 'adult'],
      },
    });
  },

  async allowanceApproved(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { amountLabel: string; allowanceId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.rewards) return null;
    const def = getNotification('N14');
    return push({
      title: def.title,
      body: formatNotificationBody(def.body, { amount: input.amountLabel }),
      category: 'rewards',
      priority: 'medium',
      data: {
        allowanceId: input.allowanceId,
        kind: 'allowance_approved',
        audienceMemberIds: input.audienceMemberIds,
      },
    });
  },

  async allowanceGranted(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { amountLabel: string; allowanceId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.rewards) return null;
    const def = getNotification('N14');
    return push({
      title: def.title,
      body: formatNotificationBody(def.body, { amount: input.amountLabel }),
      category: 'rewards',
      priority: 'medium',
      data: {
        allowanceId: input.allowanceId,
        kind: 'allowance_granted',
        audienceMemberIds: input.audienceMemberIds,
      },
    });
  },

  async streakAtRisk(push: PushFn, prefs: PoppinsNotificationPrefs, input: { memberName: string; streak: number }) {
    if (!prefs.tasks) return null;
    return push({
      title: 'Poppins · Streak check',
      body: `${input.memberName}'s ${input.streak}-day streak is at risk today. One small task keeps it alive.`,
      category: 'ai',
      priority: 'medium',
      data: { kind: 'streak_risk' },
    });
  },

  async joinPending(push: PushFn, input: { memberName: string; inviteCode: string }) {
    return push({
      title: 'Poppins · Someone wants in',
      body: `${input.memberName} requested access with ${input.inviteCode}. Review in Members.`,
      category: 'ai',
      priority: 'high',
      data: { kind: 'join_pending' },
    });
  },
};
