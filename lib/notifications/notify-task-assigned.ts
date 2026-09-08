import { assigneeMemberIdsForTask } from '@/lib/sidekick/task-assigned-notify';
import type { CreateTaskInput, HouseholdMember, HouseholdSnapshot, HouseholdTask, NotificationItem } from '@/types/orbit';

export type PushNotificationFn = (input: {
  title: string;
  body: string;
  category: NotificationItem['category'];
  priority: 'high' | 'medium' | 'low';
  data?: Record<string, unknown>;
}) => Promise<unknown>;

/** Notify each assignee when a task is newly created. */
export async function notifyTaskAssigned(
  push: PushNotificationFn,
  snapshot: Pick<HouseholdSnapshot, 'members' | 'notificationPrefs'>,
  input: CreateTaskInput,
  task: HouseholdTask,
  prefsTasksEnabled: boolean
): Promise<void> {
  if (!prefsTasksEnabled) return;

  const assigneeIds = assigneeMemberIdsForTask(snapshot.members, input, task);
  for (const memberId of assigneeIds) {
    const assignee = snapshot.members.find((member) => member.id === memberId);
    if (!assignee) continue;
    await push({
      title: 'Poppins · Tasks',
      body: `${task.title} was added to your list.`,
      category: 'tasks',
      priority: 'high',
      data: {
        kind: 'task_assigned',
        taskId: task.id,
        task: task.title,
        memberId: assignee.id,
        memberName: assignee.name,
        audienceMemberIds: [assignee.id],
      },
    });
  }
}

export function assigneeMemberForTask(
  members: HouseholdMember[],
  task: Pick<HouseholdTask, 'assignee' | 'assignees'>
): HouseholdMember | null {
  const name = task.assignees?.[0] ?? task.assignee;
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return members.find((member) => member.name.trim().toLowerCase() === needle) ?? null;
}
