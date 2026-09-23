import { getTaskAssignees } from '@/lib/tasks/split-assign';
import type { CreateTaskInput, HouseholdMember, HouseholdTask } from '@/types/orbit';

/** Member ids that should receive a new-task notification. */
export function assigneeMemberIdsForTask(
  members: HouseholdMember[],
  input: Pick<CreateTaskInput, 'assignee' | 'assignees'>,
  task?: Pick<HouseholdTask, 'assignee' | 'assignees' | 'shares'>
): string[] {
  const names = task
    ? getTaskAssignees(task)
    : input.assignees?.length
      ? input.assignees
      : input.assignee?.trim()
        ? [input.assignee.trim()]
        : [];

  const ids = new Set<string>();
  for (const rawName of names) {
    const needle = rawName.trim().toLowerCase();
    if (!needle) continue;
    const match = members.find((member) => member.name.trim().toLowerCase() === needle);
    if (match) ids.add(match.id);
  }
  return [...ids];
}
