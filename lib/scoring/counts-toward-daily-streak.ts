/**
 * Only daily and weekdays tasks affect the daily streak — Revision D §1.3.e.
 * Call from one place; do not inline.
 */

export type StreakFrequency =
  | 'daily'
  | 'weekdays'
  | '2x_weekly'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'seasonal'
  | 'as_needed'
  | 'Daily'
  | 'Weekdays'
  | 'Weekly'
  | 'None'
  | string;

export function countsTowardDailyStreak(occurrence: {
  frequency?: StreakFrequency | null;
  repeat?: StreakFrequency | null;
}): boolean {
  const raw = String(occurrence.frequency ?? occurrence.repeat ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return raw === 'daily' || raw === 'weekdays';
}
