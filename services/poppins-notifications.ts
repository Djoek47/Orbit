import type { HouseholdSnapshot, NotificationItem, PoppinsNotificationPrefs } from '@/types/orbit';
import {
  formatNotificationBody,
  getNotification,
  type NotificationId,
} from '@/constants/notifications';
import { displayTrophyName } from '@/lib/trophies/display-name';

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
  quietHoursEnabled: true,
};

type PushFn = (input: {
  title: string;
  body: string;
  category: NotificationItem['category'];
  priority?: NotificationItem['priority'];
  data?: Record<string, unknown>;
}) => Promise<NotificationItem | null>;

async function pushRegistry(
  push: PushFn,
  id: NotificationId,
  vars: Record<string, string | number>,
  meta: {
    category: NotificationItem['category'];
    priority?: NotificationItem['priority'];
    data?: Record<string, unknown>;
  }
) {
  const def = getNotification(id);
  return push({
    title: def.title,
    body: formatNotificationBody(def.body, vars),
    category: meta.category,
    priority: meta.priority ?? 'medium',
    data: { ...meta.data, notificationId: def.id },
  });
}

/** Quiet hours stub — suppress child spam when school window labels are present. */
export function isQuietHoursForChildren(household: HouseholdSnapshot, now = new Date()): boolean {
  const hour = now.getHours();
  const hasSchoolToday = household.events.some(
    (event) => event.category === 'School' && /today/i.test(event.date)
  );
  return hasSchoolToday && hour >= 8 && hour < 15;
}

/**
 * Closed registry sends only — Revision E §2.
 * Unlisted helpers removed (groceryAdded, taskOverdue, itineraryNextLeg, etc.).
 */
export const poppinsNotifications = {
  async taskCompleted(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      assignee: string;
      awardedXp: number;
      penalty: number;
      late: boolean;
      taskId: string;
    }
  ) {
    if (!prefs.tasks) return null;
    return pushRegistry(
      push,
      'N18',
      { name: input.assignee, task: input.title, xp: input.awardedXp },
      {
        category: 'ai',
        priority: input.late ? 'high' : 'medium',
        data: {
          taskId: input.taskId,
          kind: 'task_completed',
          name: input.assignee,
          memberName: input.assignee,
          task: input.title,
          xp: input.awardedXp,
        },
      }
    );
  },

  async proofSubmitted(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      assignee: string;
      taskId: string;
      proofUri?: string;
      audienceRoles?: string[];
    }
  ) {
    if (!prefs.tasks) return null;
    return pushRegistry(
      push,
      'N20',
      { name: input.assignee, task: input.title },
      {
        category: 'tasks',
        priority: 'high',
        data: {
          taskId: input.taskId,
          kind: 'proof_submitted',
          proofUri: input.proofUri,
          audienceRoles: input.audienceRoles ?? ['owner', 'admin', 'adult'],
        },
      }
    );
  },

  async proofRequested(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; adminName: string; taskId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.tasks) return null;
    return pushRegistry(
      push,
      'N03',
      { admin: input.adminName, task: input.title },
      {
        category: 'tasks',
        priority: 'high',
        data: {
          taskId: input.taskId,
          kind: 'proof_requested',
          audienceMemberIds: input.audienceMemberIds,
        },
      }
    );
  },

  async taskNotDone(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { title: string; adminName: string; taskId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.tasks) return null;
    return pushRegistry(
      push,
      'N11',
      { admin: input.adminName, task: input.title },
      {
        category: 'tasks',
        priority: 'high',
        data: {
          taskId: input.taskId,
          kind: 'task_not_done',
          audienceMemberIds: input.audienceMemberIds,
        },
      }
    );
  },

  async taskReminder(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      adminName: string;
      taskId: string;
      streak?: number;
      audienceMemberIds?: string[];
    }
  ) {
    if (!prefs.tasks) return null;
    const streakNote =
      (input.streak ?? 0) >= 2 ? ` Your ${input.streak}-day streak is at risk.` : '';
    const def = getNotification('N28');
    return push({
      title: def.title,
      body: `${formatNotificationBody(def.body, { admin: input.adminName, task: input.title })}${streakNote}`,
      category: 'tasks',
      priority: 'high',
      data: {
        taskId: input.taskId,
        kind: 'task_reminder',
        audienceMemberIds: input.audienceMemberIds,
        streak: input.streak,
      },
    });
  },

  async trophyUnlocked(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      trophy: string;
      audienceMemberIds?: string[];
      memberName?: string;
      memberId?: string;
    }
  ) {
    if (!prefs.rewards) return null;
    const trophy = displayTrophyName(input.trophy);
    return pushRegistry(
      push,
      'N12',
      { trophy },
      {
        category: 'rewards',
        priority: 'medium',
        data: {
          kind: 'trophy_unlocked',
          trophy,
          name: input.memberName,
          memberName: input.memberName,
          memberId: input.memberId,
          audienceMemberIds: input.audienceMemberIds,
        },
      }
    );
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
    const id: NotificationId = input.isNewAsk ? 'N27' : 'N26';
    return pushRegistry(
      push,
      id,
      { name: input.memberName, reward: input.title, detail: input.title },
      {
        category: 'rewards',
        priority: 'medium',
        data: {
          redemptionId: input.redemptionId,
          kind: 'reward_requested',
          name: input.memberName,
          reward: input.title,
          audienceRoles: input.audienceRoles ?? ['owner', 'admin', 'adult'],
        },
      }
    );
  },

  async rewardClaimed(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      memberName: string;
      cost: number;
      redemptionId: string;
      audienceRoles?: string[];
      /** Instant earn → N07 helper; approval-gated → N21 admin. */
      needsApproval?: boolean;
    }
  ) {
    if (!prefs.rewards) return null;
    if (input.needsApproval) {
      return pushRegistry(
        push,
        'N21',
        { name: input.memberName, reward: input.title },
        {
          category: 'rewards',
          priority: 'medium',
          data: {
            redemptionId: input.redemptionId,
            kind: 'reward_claimed',
            audienceRoles: input.audienceRoles ?? ['owner', 'admin', 'adult'],
          },
        }
      );
    }
    return pushRegistry(
      push,
      'N07',
      { reward: input.title },
      {
        category: 'rewards',
        priority: 'medium',
        data: {
          redemptionId: input.redemptionId,
          kind: 'reward_claimed',
        },
      }
    );
  },

  async rewardApproved(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: {
      title: string;
      redemptionId: string;
      adminName?: string;
      audienceMemberIds?: string[];
    }
  ) {
    if (!prefs.rewards) return null;
    return pushRegistry(
      push,
      'N09',
      { admin: input.adminName ?? 'A grown-up', reward: input.title },
      {
        category: 'rewards',
        priority: 'medium',
        data: {
          redemptionId: input.redemptionId,
          kind: 'reward_approved',
          audienceMemberIds: input.audienceMemberIds,
        },
      }
    );
  },

  async allowanceApproved(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { amountLabel: string; allowanceId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.rewards) return null;
    return pushRegistry(
      push,
      'N14',
      { amount: input.amountLabel },
      {
        category: 'rewards',
        priority: 'medium',
        data: {
          allowanceId: input.allowanceId,
          kind: 'allowance_approved',
          audienceMemberIds: input.audienceMemberIds,
        },
      }
    );
  },

  async allowanceGranted(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { amountLabel: string; allowanceId: string; audienceMemberIds?: string[] }
  ) {
    if (!prefs.rewards) return null;
    return pushRegistry(
      push,
      'N14',
      { amount: input.amountLabel },
      {
        category: 'rewards',
        priority: 'medium',
        data: {
          allowanceId: input.allowanceId,
          kind: 'allowance_granted',
          audienceMemberIds: input.audienceMemberIds,
        },
      }
    );
  },

  async streakAtRisk(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { memberName: string; streak: number; forAdmin?: boolean }
  ) {
    if (!prefs.tasks) return null;
    if (input.forAdmin) {
      return pushRegistry(
        push,
        'N23',
        { name: input.memberName, streak: input.streak },
        { category: 'ai', priority: 'medium', data: { kind: 'streak_risk' } }
      );
    }
    return pushRegistry(
      push,
      'N04',
      { streak: input.streak },
      { category: 'ai', priority: 'medium', data: { kind: 'streak_risk' } }
    );
  },

  async streakEnded(
    push: PushFn,
    prefs: PoppinsNotificationPrefs,
    input: { streak: number }
  ) {
    if (!prefs.tasks) return null;
    return pushRegistry(
      push,
      'N06',
      { streak: input.streak },
      { category: 'ai', priority: 'high', data: { kind: 'streak_ended' } }
    );
  },
};
