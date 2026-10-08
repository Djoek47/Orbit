/**
 * ChildStats helpers — incremental counter updates.
 * Spec: docs/logic/choremaxx-trophies-part2-cursor-spec.md §5
 *
 * Full wiring into the completion transaction comes later.
 * This module covers volume / XP / time-of-day deltas needed by seed examples.
 */

import type { ChildStats } from './types';

export type CompletionDeltaEvent = {
  /** Household-local hour at completion (0–23). Never UTC / device time. */
  localHour: number;
  xpAwarded: number;
  /** Domain index 0–14; sets bit in domainsTouchedMask when provided. */
  domainBit?: number;
  isHygiene: boolean;
  onDueDay: boolean;
  /**
   * Optional: child's XP total for the local calendar day *after* this completion.
   * Used to maintain xpDayMax high-water. When omitted, xpDayMax is raised to
   * max(existing, xpAwarded) as a provisional stand-in.
   */
  xpDayTotal?: number;
};

export function emptyChildStats(childId: string): ChildStats {
  return {
    childId,

    tasksCompletedTotal: 0,
    xpTotal: 0,
    xpDayMax: 0,

    longestStreak: 0,
    streaks14Count: 0,
    postBreakStreakMax: 0,
    cleanStreakMax: 0,
    backOnHorseFlag: false,
    monthsNoBreak: 0,

    tasksMorning: 0,
    tasksPreDawn: 0,
    tasksAfternoon: 0,
    tasksEvening: 0,
    firstBefore7amDays: 0,
    fullCircleDays: 0,
    tasksOnDueDay: 0,

    quickDrawFlag: false,
    sameDayCompletions: 0,
    noonClearDays: 0,
    speedrunFlag: false,
    weekClearedEarlyFlag: false,

    perfectDaysTotal: 0,
    perfectDayStreakMax: 0,
    perfectMondays: 0,
    perfectWeekdayMask: 0,
    perfectWeekendFlag: false,

    householdContributions: 0,
    firstOn100Days: 0,
    anchorCount: 0,
    weeks25Share: 0,
    weeks40Share: 0,
    weeksTopLeaderboard: 0,
    allHandsDays: 0,

    rewardsEarned: 0,
    consecutiveWeeksWithReward: 0,

    domainsTouchedMask: 0,
    distinctTasksCount: 0,
    customTasksCompleted: 0,
    weeksWith10DistinctTasks: 0,

    habitStreakMax: 0,
    habitsAt30PlusMax: 0,
    allHabitsStreakMax: 0,

    accountAgeDays: 0,
    seasonsMask: 0,
    jan1Flag: false,
    turnOfYearFlag: false,
    groundhogWeeks: 0,
    monthsWithStreak: 0,

    trophiesUnlocked: 0,
  };
}

/**
 * Incremental update for volume / XP / time-of-day counters only.
 * Completions always increment volume; hygiene still counts as a completion.
 * Returns a new object (does not mutate `stats`).
 */
export function applyCompletionDelta(
  stats: ChildStats,
  event: CompletionDeltaEvent
): ChildStats {
  const next: ChildStats = { ...stats };

  next.tasksCompletedTotal += 1;
  next.xpTotal += event.xpAwarded;

  const dayXp =
    typeof event.xpDayTotal === 'number' ? event.xpDayTotal : event.xpAwarded;
  next.xpDayMax = Math.max(next.xpDayMax, dayXp);

  const hour = ((event.localHour % 24) + 24) % 24;

  // Morning 00:00–11:59; afternoon 12:00–17:59; evening 18:00–20:59
  if (hour < 12) next.tasksMorning += 1;
  else if (hour < 18) next.tasksAfternoon += 1;
  else if (hour < 21) next.tasksEvening += 1;

  if (hour < 8) next.tasksPreDawn += 1;

  if (event.onDueDay) next.tasksOnDueDay += 1;

  if (typeof event.domainBit === 'number' && event.domainBit >= 0 && event.domainBit < 15) {
    next.domainsTouchedMask |= 1 << event.domainBit;
  }

  // isHygiene is accepted for callers; volume/xp paths above already applied.
  // XP eligibility is decided upstream — xpAwarded may be 0 for hygiene-off.
  void event.isHygiene;

  return next;
}
