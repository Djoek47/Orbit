import type { HouseholdTask } from '@/types/orbit';
import { formatAssigneeLabel } from '@/lib/tasks/split-assign';

const same = (a: string | undefined | null, b: string) =>
  (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Point every task at a member's new name. Tasks match people by name, so a rename that
 * skipped the tasks left them assigned to nobody: no "Done" button anywhere, and each daily
 * copy spawned with the old name again. Same rename the database trigger does
 * (20261020090000_task_assignee_follows_rename.sql), applied to what's on the phone.
 */
export function renameAssigneeInTasks(
  tasks: HouseholdTask[],
  oldName: string,
  newName: string
): HouseholdTask[] {
  const next = newName.trim();
  if (!oldName.trim() || !next || same(oldName, next)) return tasks;
  return tasks.map((task) => {
    if (task.assignees?.length) {
      if (!task.assignees.some((n) => same(n, oldName))) return task;
      const assignees = task.assignees.map((n) => (same(n, oldName) ? next : n));
      return {
        ...task,
        assignees,
        assignee: formatAssigneeLabel(assignees),
        shares: task.shares?.map((s) => (same(s.name, oldName) ? { ...s, name: next } : s)),
      };
    }
    return same(task.assignee, oldName) ? { ...task, assignee: next } : task;
  });
}
