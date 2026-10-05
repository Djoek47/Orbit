/**
 * Sidekick local-banner announce policy.
 *
 * Live sync may surface truly new tasks / unread inbox rows as OS banners.
 * Hydrate after sign-in / Continue-as must NOT replay history — an empty local
 * baseline looks like "everything is new" and floods the lock screen (especially
 * on Sidekick + shared devices).
 *
 * Same idea as presence-transitions: skip the first snapshot, announce diffs after.
 */
import type { HouseholdTask, NotificationItem } from '@/types/orbit';

export type SidekickAnnounceTask = Pick<
  HouseholdTask,
  'id' | 'title' | 'status' | 'assignee' | 'assignees'
>;

export type SidekickAnnounceNote = Pick<
  NotificationItem,
  'id' | 'title' | 'body' | 'isRead' | 'category' | 'data'
>;

export type SidekickAnnounceCandidate = {
  key: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

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
  tasksPrefEnabled?: boolean;
  /** Max banners per sync (default 2). */
  limit?: number;
  taskMatchesAssignee: (task: SidekickAnnounceTask, memberName: string) => boolean;
};

/**
 * First sync after empty memory must stay silent. Later syncs may announce.
 * When `announceReady` is already true, empty previous sets are still allowed
 * (e.g. brand-new Sidekick receiving their first assignment).
 */
export function shouldAnnounceSidekickDiff(input: {
  announceRequested: boolean;
  announceReady: boolean;
}): boolean {
  return Boolean(input.announceRequested && input.announceReady);
}

/**
 * Build the banners for one Sidekick sync diff.
 * Prefer inbox rows over synthetic "New task" copy when both refer to the same task.
 */
export function diffSidekickAnnouncements(
  input: DiffSidekickAnnounceInput
): SidekickAnnounceCandidate[] {
  if (!shouldAnnounceSidekickDiff(input)) return [];

  const limit = Math.max(0, input.limit ?? 2);
  if (limit === 0) return [];

  const out: SidekickAnnounceCandidate[] = [];
  const coveredTaskIds = new Set<string>();

  const newNotes = input.notifications.filter(
    (item) => !input.previousNotificationIds.has(item.id) && !item.isRead
  );
  for (const note of newNotes) {
    if (out.length >= limit) break;
    const taskId =
      typeof note.data?.taskId === 'string'
        ? note.data.taskId
        : typeof note.data?.task_id === 'string'
          ? note.data.task_id
          : null;
    if (taskId) coveredTaskIds.add(taskId);
    out.push({
      key: `note:${note.id}`,
      title: note.title,
      body: note.body,
      data: {
        ...(note.data ?? {}),
        notificationId: note.id,
        category: note.category,
      },
    });
  }

  if (input.tasksPrefEnabled === false) return out;

  const newTasks = input.tasks.filter(
    (task) =>
      !input.previousTaskIds.has(task.id) &&
      !coveredTaskIds.has(task.id) &&
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
      },
    });
  }

  return out;
}
