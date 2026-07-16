import type { HouseholdTask } from '@/types/orbit';

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

  return {
    ...task,
    id: '', // repository assigns id
    status: 'Pending',
    due: dueLabel,
    proofUri: undefined,
    proofStatus: task.proofRequired ? 'none' : undefined,
    dueAt: undefined,
  };
}
