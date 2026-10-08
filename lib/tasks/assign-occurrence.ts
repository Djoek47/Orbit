/**
 * Resolve first occurrence date for a freshly assigned task.
 * After the household daily deadline → tomorrow; otherwise today.
 */
import {
  addCalendarDays,
  formatDateInTimezone,
  isPastDailyDeadline,
  resolveHouseholdTimezone,
  wallTimeToUtc,
} from '@/lib/tasks/household-tz';
import { dueAtForFrequency, DEFAULT_DUE_TIME_LOCAL } from '@/lib/tasks/recurrence-defaults';

export type AssignOccurrenceInput = {
  now?: Date;
  dailyDeadlineHm: string;
  dueTimeLocal?: string;
  timezone?: string | null;
};

export type AssignOccurrenceResult = {
  occurrenceDate: string;
  dueLabel: string;
  dueAt: string | undefined;
  rolledToTomorrow: boolean;
};

export function resolveAssignOccurrence(input: AssignOccurrenceInput): AssignOccurrenceResult {
  const now = input.now ?? new Date();
  const timezone = resolveHouseholdTimezone(input.timezone);
  const dueTimeLocal = input.dueTimeLocal ?? input.dailyDeadlineHm ?? DEFAULT_DUE_TIME_LOCAL;
  const todayKey = formatDateInTimezone(now, timezone);
  const rolledToTomorrow = isPastDailyDeadline(now, input.dailyDeadlineHm, timezone);
  const occurrenceDate = rolledToTomorrow ? addCalendarDays(todayKey, 1) : todayKey;
  const dueLabel = rolledToTomorrow ? 'Tomorrow' : 'Today';
  const dueAtDate = wallTimeToUtc(occurrenceDate, dueTimeLocal, timezone);
  const fallback = dueAtForFrequency(
    'daily',
    new Date(`${occurrenceDate}T12:00:00`),
    dueTimeLocal
  );
  return {
    occurrenceDate,
    dueLabel,
    dueAt: (Number.isNaN(dueAtDate.getTime()) ? fallback : dueAtDate)?.toISOString(),
    rolledToTomorrow,
  };
}
