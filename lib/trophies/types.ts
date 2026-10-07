/**
 * Choremaxx Trophy engine types (Part 2).
 * Spec: docs/logic/choremaxx-trophies-part2-cursor-spec.md
 *
 * Definitions are data; evaluators are code. Part 1 (100 trophies) is pending —
 * use seed-examples until that lands.
 */

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type EvaluatorType =
  | 'counter_gte' // counter >= threshold
  | 'max_value_gte' // high-water mark >= threshold
  | 'set_size_gte' // distinct-set cardinality >= threshold
  | 'bitmask_complete' // all required bits set
  | 'boolean_flag' // one-off event occurred
  | 'ratio_gte' // share of a total >= threshold
  | 'consecutive_gte' // consecutive periods >= threshold
  | 'composite_and'; // all sub-conditions true

export type Trigger =
  | 'on_completion'
  | 'on_daily_rollover'
  | 'on_week_close'
  | 'on_household_completion'
  | 'on_reward_earned'
  | 'on_trophy_award';

export type Obtainability =
  | 'always'
  | 'requires_rewards' // household has rewards configured
  | 'requires_multi_member' // 2+ children in household
  | 'requires_custom_tasks' // household has created a custom task
  | 'requires_habits'; // household has assigned habit tasks

export interface TrophyDefinition {
  id: string; // stable slug — 'first-step', never renumber
  name: string;
  tier: Tier;
  category: string; // 'volume' | 'xp' | 'streaks' | …
  description: string;
  iconKey: string;
  evaluator: EvaluatorType;
  counter: string; // key into ChildStats
  threshold: number;
  params?: Record<string, unknown>; // bitmask value, sub-conditions, ratio base
  trigger: Trigger;
  obtainability: Obtainability;
  hidden: boolean;
  sortOrder: number;
}

export interface AwardedTrophy {
  childId: string;
  trophyId: string;
  awardedAt: string; // ISO, household-local aware
  backfilled: boolean;
  seenAt: string | null;
}

export interface TrophyProgress {
  childId: string;
  trophyId: string;
  current: number;
  target: number;
  updatedAt: string;
}

/** Sub-condition for composite_and evaluators. */
export interface CompositeCondition {
  counter: string;
  evaluator: Exclude<EvaluatorType, 'composite_and'>;
  threshold: number;
  params?: Record<string, unknown>;
}

/**
 * Per-child incremental counters. Never recompute trophies by scanning history —
 * evaluators read these fields only.
 */
export interface ChildStats {
  childId: string;

  // volume & XP
  tasksCompletedTotal: number;
  xpTotal: number;
  xpDayMax: number; // high-water mark, single day

  // streaks
  longestStreak: number;
  streaks14Count: number;
  postBreakStreakMax: number;
  cleanStreakMax: number;
  backOnHorseFlag: boolean;
  monthsNoBreak: number;

  // time of day (household-local at completion time)
  tasksMorning: number; // 00:00–11:59
  tasksPreDawn: number; // before 08:00
  tasksAfternoon: number; // 12:00–17:59
  tasksEvening: number; // 18:00–20:59
  firstBefore7amDays: number;
  fullCircleDays: number;
  tasksOnDueDay: number;

  // speed
  quickDrawFlag: boolean;
  sameDayCompletions: number;
  noonClearDays: number;
  speedrunFlag: boolean;
  weekClearedEarlyFlag: boolean;

  // perfection
  perfectDaysTotal: number;
  perfectDayStreakMax: number;
  perfectMondays: number;
  perfectWeekdayMask: number; // 7 bits, Sun..Sat
  perfectWeekendFlag: boolean;

  // household
  householdContributions: number;
  firstOn100Days: number;
  anchorCount: number;
  weeks25Share: number;
  weeks40Share: number;
  weeksTopLeaderboard: number;
  allHandsDays: number;

  // rewards
  rewardsEarned: number;
  consecutiveWeeksWithReward: number;

  // variety
  domainsTouchedMask: number; // 15 bits, one per domain
  distinctTasksCount: number;
  customTasksCompleted: number;
  weeksWith10DistinctTasks: number;

  // habits
  habitStreakMax: number;
  habitsAt30PlusMax: number;
  allHabitsStreakMax: number;

  // longevity & calendar
  accountAgeDays: number;
  seasonsMask: number; // 4 bits
  jan1Flag: boolean;
  turnOfYearFlag: boolean;
  groundhogWeeks: number;
  monthsWithStreak: number;

  // meta
  trophiesUnlocked: number;
}

/** Stats field keys readable by evaluators (excludes childId). */
export type ChildStatsCounterKey = Exclude<keyof ChildStats, 'childId'>;
