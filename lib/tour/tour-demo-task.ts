/**
 * Practice chore for the admin tour when the user skips Assign.
 * Real task in the household — so Press and hold / Complete still work.
 */

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { householdDueTimeLocal } from '@/lib/rules/household-view';
import { buildLibraryAssignInput } from '@/lib/tasks/assign-from-library';
import { allLibraryTasks, type LibraryTask } from '@/lib/tasks/task-library';
import type { CreateTaskInput, HouseholdMember, HouseholdSnapshot } from '@/types/orbit';

export const TOUR_PRACTICE_TASK_ID = 'wipe_down_kitchen_counters';
export const TOUR_PRACTICE_TITLE = 'Wipe down kitchen counters';

export function pickTourPracticeAssignee(
  members: HouseholdMember[],
  preferName?: string | null
): HouseholdMember | null {
  const active = members.filter(
    (member) => member.status === 'active' && member.role !== 'guest' && member.role !== 'shared-device'
  );
  if (preferName) {
    const named = active.find((member) => member.name === preferName);
    if (named) return named;
  }
  const sidekick = active.find((member) => isSidekickRole(member.role));
  if (sidekick) return sidekick;
  return active[0] ?? null;
}

export function pickTourPracticeLibraryTask(): LibraryTask | null {
  const tasks = allLibraryTasks();
  return (
    tasks.find((task) => task.id === TOUR_PRACTICE_TASK_ID) ??
    tasks.find((task) => task.name === TOUR_PRACTICE_TITLE) ??
    tasks.find((task) => /wipe|dishwasher|recycling/i.test(task.name)) ??
    tasks[0] ??
    null
  );
}

export function buildTourPracticeTaskInput(
  household: HouseholdSnapshot,
  assignee: HouseholdMember
): CreateTaskInput | null {
  const library = pickTourPracticeLibraryTask();
  if (!library) return null;
  return buildLibraryAssignInput(library, assignee.name, 'daily', {
    now: new Date(),
    dailyDeadlineHm: householdDueTimeLocal(household),
    dueTimeLocal: householdDueTimeLocal(household),
    timezone: household.timezone,
    assigneeMember: assignee,
  });
}

/** True when the household already has an open practice row for the tour. */
export function householdHasOpenTourPractice(
  tasks: { title: string; status: string }[],
  assigneeName?: string | null
): boolean {
  return tasks.some(
    (task) =>
      task.status !== 'Completed' &&
      task.status !== 'Cancelled' &&
      task.status !== 'Expired' &&
      task.status !== 'Missed' &&
      (task.title === TOUR_PRACTICE_TITLE || /wipe down kitchen counters/i.test(task.title)) &&
      (!assigneeName || true)
  );
}
