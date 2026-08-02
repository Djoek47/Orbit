/**
 * EXAMPLE trophy definitions for engine verification.
 *
 * Part 1 (`choremaxx-100-trophies-part1.md`) is NOT available yet.
 * These ≤8 stubs prove each of the eight evaluator types works.
 * Replace with the real 100 when Part 1 lands — do not invent production names/thresholds here.
 *
 * EXAMPLE ONLY — not shipping trophy copy.
 */

import type { TrophyDefinition } from './types';

/** Marked EXAMPLES until Part 1 definitions land. */
export const EXAMPLE_TROPHY_DEFINITIONS: TrophyDefinition[] = [
  // 1. counter_gte
  {
    id: 'example-first-step',
    name: 'EXAMPLE: First Step',
    tier: 'bronze',
    category: 'volume',
    description: 'EXAMPLE — complete 1 task (counter_gte).',
    iconKey: 'example-first-step',
    evaluator: 'counter_gte',
    counter: 'tasksCompletedTotal',
    threshold: 1,
    trigger: 'on_completion',
    obtainability: 'always',
    hidden: false,
    sortOrder: 1,
  },
  // 2. max_value_gte
  {
    id: 'example-banked-day',
    name: 'EXAMPLE: Banked Day',
    tier: 'bronze',
    category: 'xp',
    description: 'EXAMPLE — single-day XP high-water ≥ 100 (max_value_gte).',
    iconKey: 'example-banked-day',
    evaluator: 'max_value_gte',
    counter: 'xpDayMax',
    threshold: 100,
    trigger: 'on_completion',
    obtainability: 'always',
    hidden: false,
    sortOrder: 2,
  },
  // 3. set_size_gte (popcount of domainsTouchedMask)
  {
    id: 'example-jack-of-trades',
    name: 'EXAMPLE: Jack of Trades',
    tier: 'silver',
    category: 'variety',
    description: 'EXAMPLE — touch 3 distinct domains (set_size_gte).',
    iconKey: 'example-jack-of-trades',
    evaluator: 'set_size_gte',
    counter: 'domainsTouchedMask',
    threshold: 3,
    trigger: 'on_completion',
    obtainability: 'always',
    hidden: false,
    sortOrder: 3,
  },
  // 4. bitmask_complete (all 7 weekday bits = 127)
  {
    id: 'example-full-house',
    name: 'EXAMPLE: Full House',
    tier: 'gold',
    category: 'perfection',
    description: 'EXAMPLE — perfect every weekday once (bitmask_complete).',
    iconKey: 'example-full-house',
    evaluator: 'bitmask_complete',
    counter: 'perfectWeekdayMask',
    threshold: 127,
    params: { requiredMask: 127 },
    trigger: 'on_daily_rollover',
    obtainability: 'always',
    hidden: false,
    sortOrder: 4,
  },
  // 5. boolean_flag
  {
    id: 'example-quick-draw',
    name: 'EXAMPLE: Quick Draw',
    tier: 'silver',
    category: 'speed',
    description: 'EXAMPLE — quick-draw flag fired (boolean_flag).',
    iconKey: 'example-quick-draw',
    evaluator: 'boolean_flag',
    counter: 'quickDrawFlag',
    threshold: 1,
    trigger: 'on_completion',
    obtainability: 'always',
    hidden: true,
    sortOrder: 5,
  },
  // 6. ratio_gte (tasksOnDueDay / tasksCompletedTotal)
  {
    id: 'example-on-time-share',
    name: 'EXAMPLE: On-Time Share',
    tier: 'silver',
    category: 'speed',
    description: 'EXAMPLE — ≥50% of completions on due day (ratio_gte).',
    iconKey: 'example-on-time-share',
    evaluator: 'ratio_gte',
    counter: 'tasksOnDueDay',
    threshold: 0.5,
    params: { baseCounter: 'tasksCompletedTotal' },
    trigger: 'on_completion',
    obtainability: 'always',
    hidden: false,
    sortOrder: 6,
  },
  // 7. consecutive_gte
  {
    id: 'example-well-earned',
    name: 'EXAMPLE: Well Earned',
    tier: 'gold',
    category: 'rewards',
    description: 'EXAMPLE — 4 consecutive weeks with a reward (consecutive_gte).',
    iconKey: 'example-well-earned',
    evaluator: 'consecutive_gte',
    counter: 'consecutiveWeeksWithReward',
    threshold: 4,
    trigger: 'on_week_close',
    obtainability: 'requires_rewards',
    hidden: false,
    sortOrder: 7,
  },
  // 8. composite_and
  {
    id: 'example-eternal-starter',
    name: 'EXAMPLE: Eternal Starter',
    tier: 'platinum',
    category: 'longevity',
    description:
      'EXAMPLE — accountAgeDays ≥ 30 AND monthsWithStreak ≥ 1 (composite_and).',
    iconKey: 'example-eternal-starter',
    evaluator: 'composite_and',
    counter: 'accountAgeDays',
    threshold: 2,
    params: {
      conditions: [
        {
          counter: 'accountAgeDays',
          evaluator: 'counter_gte',
          threshold: 30,
        },
        {
          counter: 'monthsWithStreak',
          evaluator: 'counter_gte',
          threshold: 1,
        },
      ],
    },
    trigger: 'on_daily_rollover',
    obtainability: 'always',
    hidden: false,
    sortOrder: 8,
  },
];

/** Alias — EXAMPLE seed only until Part 1 lands. */
export const SEED_EXAMPLE_TROPHIES = EXAMPLE_TROPHY_DEFINITIONS;
