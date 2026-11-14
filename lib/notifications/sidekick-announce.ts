/**
 * Sidekick local-banner announce policy.
 *
 * Live sync may surface truly new tasks / unread inbox rows as OS banners.
 * Hydrate after sign-in / Continue-as must NOT replay history — an empty local
 * baseline looks like "everything is new" and floods the lock screen (especially
 * on Sidekick + shared devices).
 *
 * Smart delivery collapses same-day assignment noise into one digest.
 * Persisted announce-ledger keys (passed in) stop reopen replays.
 */
import {
  reduceBannersWithSmartDigest,
  type DigestCandidate,
} from '@/lib/notifications/smart-digest';
import type { HouseholdTask, NotificationItem } from '@/types/orbit';

export type SidekickAnnounceTask = Pick<
  HouseholdTask,
  'id' | 'title' | 'status' | 'assignee' | 'assignees'
>;

export type SidekickAnnounceNote = Pick<
  NotificationItem,
  'id' | 'title' | 'body' | 'isRead' | 'category' | 'data'
>;

export type SidekickAnnounceCandidate = DigestCandidate;

export type DiffSidekickAnnounceInput = {
  /** Caller asked to announce (live sync). */
  announceRequested: boolean;
  /** False until the first successful Sidekick sync after sign-in. */
  announceReady: boolean;
  previousTaskIds: ReadonlySet<string>;
  previousNotificationIds: ReadonlySet<string>;
  tasks: readonly SidekickAnnounceTask[];
  notifications: readonly SidekickAnnounceNote[];
  /** Current Sidekick display name — used for assignee matching. */
  memberName: string;
  /** Member id for digest + open-as targeting. */
  targetMemberId?: string;
  tasksPrefEnabled?: boolean;
  /** Smart delivery ON → roll up 2+ assignment banners. */
  smartDelivery?: boolean;
  /** Max raw candidates before Smart rollup (default 12). */
  limit?: number;
  /** Locally dismissed / tombstoned inbox ids. */
  dismissedNotificationIds?: ReadonlySet<string>;
  /** Persisted announce-ledger keys already shown. */
  announcedKeys?: ReadonlySet<string>;
  taskMatchesAssignee: (task: SidekickAnnounceTask, memberName: string) => boolean;
};

/**
 * First sync after empty memory must stay silent. Later syncs may announce.
 */
export function shouldAnnounceSidekickDiff(input: {
  announceRequested: boolean;
  announceReady: boolean;
}): boolean {
  return Boolean(input.announceRequested && input.announceReady);
}

function noteTaskId(note: SidekickAnnounceNote): string | null {
  if (typeof note.data?.taskId === 'string') return note.data.taskId;
  if (typeof note.data?.task_id === 'string') return note.data.task_id;
  return null;
}

/**
 * Build the banners for one Sidekick sync diff.
 * Prefer inbox rows over synthetic "New task" copy when both refer to the same task.
 * Smart mode collapses 2+ assignment banners into one digest.
 */
export function diffSidekickAnnouncements(
  input: DiffSidekickAnnounceInput
): SidekickAnnounceCandidate[] {
  if (!shouldAnnounceSidekickDiff(input)) return [];

  const limit = Math.max(0, input.limit ?? 12);
  if (limit === 0) return [];

  const dismissed = input.dismissedNotificationIds ?? new Set<string>();
  const announced = input.announcedKeys ?? new Set<string>();
  const out: SidekickAnnounceCandidate[] = [];
  const coveredTaskIds = new Set<string>();
  const targetMemberId = input.targetMemberId ?? '';

  const newNotes = input.notifications.filter(
    (item) =>
      !input.previousNotificationIds.has(item.id) &&
      !item.isRead &&
      !dismissed.has(item.id) &&
      !announced.has(`note:${item.id}`)
  );
  for (const note of newNotes) {
    if (out.length >= limit) break;
    const taskId = noteTaskId(note);
    if (taskId) coveredTaskIds.add(taskId);
    out.push({
      key: `note:${note.id}`,
      title: note.title,
      body: note.body,
      data: {
        ...(note.data ?? {}),
        notificationId: note.id,
        category: note.category,
        targetMemberId: targetMemberId || undefined,
        memberId:
          typeof note.data?.memberId === 'string' ? note.data.memberId : targetMemberId || undefined,
        memberName: input.memberName,
      },
    });
  }

  if (input.tasksPrefEnabled === false) {
    return reduceBannersWithSmartDigest({
      candidates: out,
      smartDelivery: input.smartDelivery !== false,
      targetMemberId,
      memberName: input.memberName,
    }).filter((banner) => !announced.has(banner.key));
  }

  const newTasks = input.tasks.filter(
    (task) =>
      !input.previousTaskIds.has(task.id) &&
      !coveredTaskIds.has(task.id) &&
      !announced.has(`task:${task.id}`) &&
      input.taskMatchesAssignee(task, input.memberName) &&
      task.status !== 'Completed' &&
      task.status !== 'Cancelled'
  );
  for (const task of newTasks) {
    if (out.length >= limit) break;
    out.push({
      key: `task:${task.id}`,
      title: 'Poppins · Tasks',
      body: `${task.title} was added to your list.`,
      data: {
        taskId: task.id,
        category: 'tasks',
        kind: 'task_assigned',
        targetMemberId: targetMemberId || undefined,
        memberId: targetMemberId || undefined,
        memberName: input.memberName,
        audienceMemberIds: targetMemberId ? [targetMemberId] : undefined,
      },
    });
  }

  const reduced = reduceBannersWithSmartDigest({
    candidates: out,
    smartDelivery: input.smartDelivery !== false,
    targetMemberId,
    memberName: input.memberName,
  });

  return reduced.filter((banner) => !announced.has(banner.key));
}
