/**
 * ChoreMaxx scoring constants — Revision D.
 * This is the ONLY place these numbers exist.
 * Spec: docs/logic/choremaxx-revision-d-spec.md §1.1
 */

/** Late Credit: XP awarded when a task is completed after its
 *  deadline but before 23:59 the same day.
 *  Key = the task's full XP value. Value = what late earns.
 *  These six keys are the ONLY valid XP values in the app. */
export const LATE_CREDIT: Record<number, number> = {
  5: 3,
  10: 7,
  15: 12,
  20: 16,
  25: 20,
  30: 25,
};

/** Bundle bonus (Revision B §4.1) at full and late rates. */
export const BUNDLE_BONUS_FULL = 10;
export const BUNDLE_BONUS_LATE = 7; // = LATE_CREDIT[10]

/** Hour of day, household-local, when tasks expire. 23:59:59. */
export const EXPIRY_HOUR = 23;
export const EXPIRY_MINUTE = 59;

/** Streak Rescue costs 10% of the week's gross XP, PER RESCUED DAY. */
export const RESCUE_COST_PCT_PER_DAY = 0.1;

/** Maximum consecutive days that can be rescued. The 3rd
 *  consecutive miss ends the streak permanently. */
export const MAX_RESCUABLE_CONSECUTIVE_DAYS = 2;

/** A streak also ends if this many days are missed inside a
 *  rolling window, even when not consecutive. */
export const ROLLING_MISS_LIMIT = 3;
export const ROLLING_MISS_WINDOW_DAYS = 7;

/**
 * The first Streak Rescue a member ever accepts is free —
 * only after they press the confirmation prompt (UI).
 * See §1.5.6 / product decision on v9.
 */
export const FIRST_RESCUE_IS_FREE = true;

/** Week runs Monday 00:00:00 → Sunday 23:59:59, household-local. */
export const WEEK_STARTS_ON = 1; // 1 = Monday

/** How many days back an admin may backdate Recess. */
export const RECESS_BACKDATE_DAYS = 3;

/** Minutes before a deadline that the final reminder fires. */
export const DEADLINE_REMINDER_MINUTES = 30;
