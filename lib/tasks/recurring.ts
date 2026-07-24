import type { HouseholdTask } from '@/types/orbit';
import { buildShares, getTaskAssignees, isSplitTask } from '@/lib/tasks/split-assign';

/** Build the next occurrence after completing a repeating task (simple label bump). */
export function spawnNextOccurrence(task: HouseholdTask): HouseholdTask | null {
  if (task.repeat === 'None') {
    return null;
  }

  const dueLabel =
    task.repeat === 'Daily'
      ? 'Tomorrow'
      : task.repeat === 'Weekdays'
        ? 'Next weekday'
        : 'Next week';

  const names = getTaskAssignees(task);

  return {
    ...task,
    id: '', // repository assigns id
    status: 'Pending',
    due: dueLabel,
    proofUri: undefined,
    proofStatus: task.proofRequired ? 'none' : undefined,
    dueAt: undefined,
    // Fresh split shares for the next occurrence
    assignees: isSplitTask(task) ? names : task.assignees,
    shares: isSplitTask(task) ? buildShares(names, task.proofRequired) : undefined,
  };
}
