/**
 * From-now-on edits to a repeating chore.
 * Repeat/assignee/title are the household rule, not a frozen assign-time snapshot.
 */

import { isOpenTask } from '@/lib/tasks/cancel';
import { isExpiredStatus, seriesDefinitionId } from '@/lib/tasks/recurring';
import type { HouseholdTask } from '@/types/orbit';

export type SeriesEditScope = 'this' | 'future';

export type SeriesPatch = Partial<
  Pick<HouseholdTask, 'repeat' | 'assignee' | 'title' | 'category' | 'xp' | 'difficulty' | 'description'>
>;

export const TASK_REPEAT_CHOICES: HouseholdTask['repeat'][] = ['Daily', 'Weekly', 'Weekdays', 'None'];

export function occurrenceSortKey(task: HouseholdTask): string {
  if (task.occurrenceDate) return task.occurrenceDate;
  if (task.dueAt) {
    const d = new Date(task.dueAt);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return '9999-12-31';
}

export function isSeriesRuleChange(
  before: HouseholdTask | undefined,
  after: Pick<HouseholdTask, 'repeat' | 'assignee' | 'title'>
): boolean {
  if (!before) return after.repeat !== 'None';
  return (
    before.repeat !== after.repeat ||
    before.assignee !== after.assignee ||
    before.title !== after.title
  );
}

export function defaultSeriesScope(
  before: HouseholdTask | undefined,
  after: Pick<HouseholdTask, 'repeat' | 'assignee' | 'title'>
): SeriesEditScope {
  if (!before) return 'this';
  if (!isSeriesRuleChange(before, after)) return 'this';
  if (before.repeat === 'None' && after.repeat === 'None') return 'this';
  return 'future';
}

function isFrozenHistory(task: HouseholdTask): boolean {
  return (
    task.status === 'Completed' ||
    task.status === 'Cancelled' ||
    isExpiredStatus(task.status)
  );
}

/**
 * Apply a patch to this occurrence, or this day and every later open occurrence.
 * Stopping repeat (None) keeps this row’s status and cancels later open days.
 */
export function applySeriesPatch(
  tasks: HouseholdTask[],
  origin: HouseholdTask,
  patch: SeriesPatch,
  scope: SeriesEditScope = 'future'
): HouseholdTask[] {
  const defId = origin.definitionId || seriesDefinitionId(origin);
  const originKey = occurrenceSortKey(origin);
  const stopping = patch.repeat === 'None' && origin.repeat !== 'None';

  return tasks.map((task) => {
    const sameSeries =
      task.id === origin.id ||
      seriesDefinitionId(task) === seriesDefinitionId(origin) ||
      (task.definitionId != null && origin.definitionId != null && task.definitionId === origin.definitionId);

    if (!sameSeries) return task;

    // Stamp the whole series so a later title/assignee edit cannot split history.
    const stamped: HouseholdTask = { ...task, definitionId: defId };

    if (task.id === origin.id) {
      return {
        ...stamped,
        ...patch,
        definitionId: defId,
      };
    }

    if (scope !== 'future') return stamped;
    if (occurrenceSortKey(task) < originKey) return stamped;

    if (stopping) {
      if (isFrozenHistory(task) || !isOpenTask(task)) return stamped;
      return {
        ...stamped,
        repeat: 'None',
        status: 'Cancelled',
        due: 'Cancelled · series stopped',
      };
    }

    if (isFrozenHistory(task)) return stamped;

    const next: HouseholdTask = { ...stamped };
    if (patch.repeat !== undefined) next.repeat = patch.repeat;
    if (patch.assignee !== undefined) next.assignee = patch.assignee;
    if (patch.title !== undefined) next.title = patch.title;
    if (patch.category !== undefined) next.category = patch.category;
    return next;
  });
}

export function seriesMembers(tasks: HouseholdTask[], origin: HouseholdTask): HouseholdTask[] {
  const originId = seriesDefinitionId(origin);
  return tasks.filter(
    (task) =>
      task.id === origin.id ||
      seriesDefinitionId(task) === originId ||
      (task.definitionId && origin.definitionId && task.definitionId === origin.definitionId)
  );
}
