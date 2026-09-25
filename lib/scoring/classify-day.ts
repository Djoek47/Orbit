/**
 * Day classification for streak cliffs — Revision D §1.4.
 * Neutral and Recess days are skipped — neither miss nor reset.
 */

import { countsTowardDailyStreak } from '@/lib/scoring/counts-toward-daily-streak';

export type DayClass = 'complete' | 'missed' | 'neutral' | 'recess';

export type QualifyingOccurrence = {
  status: 'pending' | 'late' | 'completed' | 'expired';
  frequency?: string | null;
  repeat?: string | null;
  /** True when member was on Recess this day. */
  onRecess?: boolean;
};

/**
 * A day is missed when ≥1 qualifying (daily/weekdays) task expired uncompleted.
 * Complete = all qualifying tasks completed (on time or late).
 * Neutral = no qualifying tasks due.
 * Recess = member on Recess — skipped entirely.
 */
export function classifyDay(input: {
  onRecess?: boolean;
  occurrences: QualifyingOccurrence[];
}): DayClass {
  if (input.onRecess) return 'recess';

  const qualifying = input.occurrences.filter((o) => countsTowardDailyStreak(o));
  if (qualifying.length === 0) return 'neutral';

  const anyExpired = qualifying.some((o) => o.status === 'expired');
  if (anyExpired) return 'missed';

  const allDone = qualifying.every((o) => o.status === 'completed');
  if (allDone) return 'complete';

  // Still pending/late during the day — at rollover these become expired.
  // classifyDay is evaluated after rollover expiry, so pending/late here
  // means the job hasn't run; treat unfinished as missed for safety.
  return 'missed';
}
