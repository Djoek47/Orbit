/**
 * Eight live evaluator trophies (Part 2 names).
 * Part 1 (`choremaxx-100-trophies-part1.md`) will replace this catalog —
 * keep evaluator ids/thresholds stable until then.
 */

import type { TrophyDefinition } from './types';

export const EXAMPLE_TROPHY_DEFINITIONS: TrophyDefinition[] = [
  // 1. counter_gte
  {
    id: 'example-first-step',
    name: 'First Step',
    tier: 'bronze',
    category: 'volume',
    description: 'Complete your first task.',
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
    name: 'Banked Day',
    tier: 'bronze',
    category: 'xp',
    description: 'Bank 100 XP in a single day.',
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
    name: 'Jack of Trades',
    tier: 'silver',
    category: 'variety',
    description: 'Touch three different domains.',
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
    name: 'Full House',
    tier: 'gold',
    category: 'perfection',
    description: 'Perfect every weekday once.',
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
    name: 'Quick Draw',
    tier: 'silver',
    category: 'speed',
    description: 'Finish a task the moment it opens.',
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
    name: 'On-Time Share',
    tier: 'silver',
    category: 'speed',
    description: 'Complete at least half of your tasks on the due day.',
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
    name: 'Well Earned',
    tier: 'gold',
    category: 'rewards',
    description: 'Earn a reward four weeks in a row.',
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
    name: 'Eternal Starter',
    tier: 'platinum',
    category: 'longevity',
    description: 'Stay active for a month with a streak on the board.',
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

/** Alias — eight live evaluators until Part 1 lands. */
export const SEED_EXAMPLE_TROPHIES = EXAMPLE_TROPHY_DEFINITIONS;
