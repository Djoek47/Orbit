import type { HouseholdTask } from '@/types/orbit';

/**
 * Evenly reassign open tasks between two people (round-robin by current order).
 * Completed tasks keep their assignee.
 */
export function splitOpenTasksBetweenTwo<T extends Pick<HouseholdTask, 'id' | 'assignee' | 'status'>>(
  tasks: T[],
  nameA: string,
  nameB: string
): T[] {
  if (!nameA.trim() || !nameB.trim() || nameA === nameB) {
    return tasks;
  }

  let turn = 0;
  return tasks.map((task) => {
    if (task.status === 'Completed') {
      return task;
    }
    const assignee = turn % 2 === 0 ? nameA : nameB;
    turn += 1;
    return { ...task, assignee };
  });
}
