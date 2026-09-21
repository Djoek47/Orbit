/**
 * House Rules v4 — expire open tasks at constants.expiryTime (DEAD-04).
 * Recess days skip expiry (STRK-04: tasks off, streaks frozen).
 * Boundaries use household IANA timezone — never runtime-local Date(y,m,d,…).
 */
import { formatLocalDate } from '@/lib/streaks/local-date';
import { resolveOccurrenceDate } from '@/lib/tasks/due-label';
import {
  DEFAULT_HOUSEHOLD_TIMEZONE,
  addCalendarDays,
  expiryInstantInTimezone,
  formatDateInTimezone,
  resolveHouseholdTimezone,
} from '@/lib/tasks/household-tz';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import { getTaskAssignees } from '@/lib/tasks/split-assign';
import type { HouseholdTask } from '@/types/orbit';

const OPEN: HouseholdTask['status'][] = ['Pending', 'In Progress', 'Overdue'];

export function occurrenceDateKey(
  task: HouseholdTask,
  now = new Date(),
  timezone = DEFAULT_HOUSEHOLD_TIMEZONE
): string | null {
  const resolved = resolveOccurrenceDate(task, now);
  if (resolved) return resolved;
  if (/yesterday/i.test(task.due)) {
    return addCalendarDays(formatDateInTimezone(now, timezone), -1);
  }
  return null;
}

/**
 * Inclusive end of the occurrence day at HH:MM:59.999.
 * Pass timezone for household IANA; omit for runtime-local (tests / legacy).
 */
export function expiryInstantLocal(
  dateKey: string,
  expiryHm: string,
  timezone?: string
): Date {
  if (timezone) {
    return expiryInstantInTimezone(dateKey, expiryHm, timezone);
  }
  const [h, m] = expiryHm.split(':').map(Number);
  const hours = h ?? 0;
  const minutes = m ?? 0;
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, hours, minutes, 59, 999);
}

export function expireOpenTasksAtBoundary(
  tasks: HouseholdTask[],
  now: Date,
  input: {
    expiryHm: string;
    /** When set (including null/undefined value), use household IANA TZ. Omit key for device-local. */
    timezone?: string | null;
    assigneeOnRecess?: (assigneeName: string, dateKey: string) => boolean;
  }
): HouseholdTask[] {
  const useHouseholdTz = Object.prototype.hasOwnProperty.call(input, 'timezone');
  const timezone = useHouseholdTz ? resolveHouseholdTimezone(input.timezone) : null;
  const todayKey = timezone ? formatDateInTimezone(now, timezone) : formatLocalDate(now);
  const expiredAt = now.toISOString();
  return tasks.map((task) => {
    if (!OPEN.includes(task.status) || isExpiredStatus(task.status)) return task;
    const dateKey = occurrenceDateKey(task, now, timezone ?? DEFAULT_HOUSEHOLD_TIMEZONE);
    if (!dateKey) return task;
    if (dateKey > todayKey) return task;
    const boundary = timezone
      ? expiryInstantInTimezone(dateKey, input.expiryHm, timezone)
      : expiryInstantLocal(dateKey, input.expiryHm);
    if (now.getTime() <= boundary.getTime()) return task;
    const names = getTaskAssignees(task);
    if (
      names.length > 0 &&
      names.every((name) => input.assigneeOnRecess?.(name, dateKey))
    ) {
      return task;
    }
    return { ...task, status: 'Expired' as const, expiredAt: task.expiredAt ?? expiredAt };
  });
}
