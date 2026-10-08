/**
 * Only daily and weekdays chores affect the daily streak — Revision D §1.3.e.
 * Hygiene (decision B): own streak / 0 XP path — does NOT feed the chore daily streak.
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

export function isHygieneForStreak(occurrence: {
  tracking?: 'xp' | 'streak' | null;
  category?: string | null;
}): boolean {
  if (occurrence.tracking === 'streak') return true;
  const cat = String(occurrence.category ?? '');
  return /hygiene/i.test(cat) || cat === 'personal_hygiene';
}

export function countsTowardDailyStreak(occurrence: {
  frequency?: StreakFrequency | null;
  repeat?: StreakFrequency | null;
  tracking?: 'xp' | 'streak' | null;
  category?: string | null;
}): boolean {
  // Decision B — hygiene builds its own habit signal, not the chore daily streak.
  if (isHygieneForStreak(occurrence)) return false;

  const raw = String(occurrence.frequency ?? occurrence.repeat ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return raw === 'daily' || raw === 'weekdays';
}
