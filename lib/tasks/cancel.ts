import type { CancelTaskScope, HouseholdTask } from '@/types/orbit';

/** Open work still needs doing — excludes completed and cancelled. */
export function isOpenTask(task: Pick<HouseholdTask, 'status'>) {
  return task.status !== 'Completed' && task.status !== 'Cancelled';
}

/** Match other occurrences in the same recurring series. */
export function isSameTaskSeries(a: HouseholdTask, b: HouseholdTask) {
  return (
    a.title === b.title &&
    a.assignee === b.assignee &&
    a.category === b.category &&
    a.repeat === b.repeat &&
    a.repeat !== 'None'
  );
}

export function describeCancelScope(task: HouseholdTask, scope: CancelTaskScope) {
  if (scope === 'future' && task.repeat !== 'None') {
    return 'This occurrence and all future ones in the series will be cancelled. Completed history stays.';
  }
  return 'Only this occurrence will be cancelled. Recurring series (if any) can continue.';
}
