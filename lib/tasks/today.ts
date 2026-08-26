/**
 * Shared “today” task filter for Home counters, Tasks tab, and streak gate.
 *
 * Open tasks count when due today / overdue.
 * Completed tasks count only when finished today (label or completedAt).
 */

import { formatLocalDate } from '@/lib/streaks/local-date';
import type { HouseholdTask } from '@/types/orbit';

/** True when the due label is today-scoped (includes “Today, …”). */
export function isDueTodayLabel(due: string): boolean {
  return /today/i.test(due);
}

/** True when a completed task’s due/status label marks it finished today. */
export function isCompletedTodayLabel(due: string): boolean {
  return /completed today|done today/i.test(due);
}

export function isCompletedToday(
  task: Pick<HouseholdTask, 'status' | 'due' | 'completedAt'>,
  now: Date = new Date(),
  timeZone?: string
): boolean {
  if (task.status !== 'Completed') return false;
  if (isCompletedTodayLabel(task.due)) return true;
  if (task.completedAt) {
    try {
      return formatLocalDate(new Date(task.completedAt), timeZone) === formatLocalDate(now, timeZone);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Open tasks that belong in today’s list (due today or overdue).
 * Excludes completed / cancelled.
 */
export function isDueToday(task: Pick<HouseholdTask, 'status' | 'due'>): boolean {
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  return task.status === 'Overdue' || isDueTodayLabel(task.due);
}

/**
 * Canonical today scope for Home counters + streak gate:
 * - open + (due today OR overdue)
 * - completed today only
 */
export function isTodayTask(
  task: Pick<HouseholdTask, 'status' | 'due' | 'completedAt'>,
  now: Date = new Date(),
  timeZone?: string
): boolean {
  if (task.status === 'Cancelled') return false;
  if (task.status === 'Completed') {
    return isCompletedToday(task, now, timeZone);
  }
  return isDueToday(task);
}
