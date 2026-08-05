/**
 * House Rules registry — Revision D §4.
 * Every rule is conditional on household configuration.
 * Custom house rules are display-only and MUST NOT alter app mechanics.
 */

import {
  FIRST_RESCUE_IS_FREE,
  LATE_CREDIT,
  MAX_RESCUABLE_CONSECUTIVE_DAYS,
  RESCUE_COST_PCT_PER_DAY,
  ROLLING_MISS_LIMIT,
  ROLLING_MISS_WINDOW_DAYS,
} from '@/constants/scoring';
import { VOCAB } from '@/constants/vocabulary';

export type RewardModel = 'xp_only' | 'allowance' | 'full' | string;
/** meritocracy ≡ weighted, equity ≡ flat in HouseholdSnapshot.rewardMode */
export type ScoringMode = 'meritocracy' | 'equity' | 'weighted' | 'flat' | string;

export type HouseRulesHousehold = {
  rewardModel?: RewardModel | null;
  rewardMode?: ScoringMode | null;
  /** When false, XP mechanics are off. */
  xpEnabled?: boolean;
  allowanceEnabled?: boolean;
  lateCreditEnabled?: boolean;
  streakEnabled?: boolean;
  recessEnabled?: boolean;
  crownsEnabled?: boolean;
  bundleBonusEnabled?: boolean;
  hygieneTrackedAsStreak?: boolean;
  defaultDeadlineLabel?: string; // e.g. '7:00 PM'
};

export type HouseRulesMember = {
  id: string;
  homeworkProofRequired?: boolean;
};

export type RuleSection =
  | 'earning'
  | 'deadlines'
  | 'streaks'
  | 'rewards'
  | 'proof'
  | 'recess'
  | 'crowns'
  | 'custom';

export type RuleEntry = {
  id: string;
  section: RuleSection;
  appliesWhen: (h: HouseRulesHousehold, m?: HouseRulesMember) => boolean;
  adultText: (h: HouseRulesHousehold, m?: HouseRulesMember) => string;
  kidText: (h: HouseRulesHousehold, m?: HouseRulesMember) => string;
  order: number;
};

function usesXp(h: HouseRulesHousehold): boolean {
  if (h.xpEnabled === false) return false;
  if (h.rewardModel === 'allowance') return false;
  return true;
}

function usesAllowance(h: HouseRulesHousehold): boolean {
  if (h.allowanceEnabled === false) return false;
  if (h.rewardModel === 'xp_only') return false;
  return h.rewardModel === 'allowance' || h.rewardModel === 'full' || h.allowanceEnabled === true;
}

function lateTableAdult(): string {
  const rows = Object.entries(LATE_CREDIT)
    .map(([full, late]) => `${full} → ${late}`)
    .join(', ');
  return `${VOCAB.lateCredit} table (full → late): ${rows}.`;
}

export const RULE_REGISTRY: RuleEntry[] = [
  {
    id: 'xp-meritocracy',
    section: 'earning',
    order: 10,
    appliesWhen: (h) =>
      usesXp(h) && h.rewardMode !== 'equity' && h.rewardMode !== 'flat',
    adultText: () =>
      'Tasks earn XP by difficulty (5–30). Completing on time awards the full value.',
    kidText: () => 'Harder jobs give more points. Finish on time to get all of them.',
  },
  {
    id: 'xp-equity',
    section: 'earning',
    order: 11,
    appliesWhen: (h) =>
      usesXp(h) && (h.rewardMode === 'equity' || h.rewardMode === 'flat'),
    adultText: () => 'Equity mode: every XP-eligible task is worth 10 XP (late = 7).',
    kidText: () => 'Every job is worth the same points.',
  },
  {
    id: 'bundle-bonus',
    section: 'earning',
    order: 20,
    appliesWhen: (h) => usesXp(h) && h.bundleBonusEnabled !== false,
    adultText: () =>
      'Bundle bonus: +10 XP when a domain group is finished on time (+7 if any task was late).',
    kidText: () => 'Finish a whole group of jobs to earn a little bonus.',
  },
  {
    id: 'allowance',
    section: 'rewards',
    order: 30,
    appliesWhen: (h) => usesAllowance(h),
    adultText: () => 'Allowance can be sent on the household schedule. Manual Send always works.',
    kidText: () => 'Grown-ups can send your allowance.',
  },
  {
    id: 'deadlines',
    section: 'deadlines',
    order: 40,
    appliesWhen: () => true,
    adultText: (h) =>
      `Default daily deadline is ${h.defaultDeadlineLabel ?? '7:00 PM'} household-local. Weekly tasks close Sunday; monthly on the last Sunday.`,
    kidText: (h) =>
      `Finish your tasks by ${h.defaultDeadlineLabel ?? '7:00 PM'} to get all your points.`,
  },
  {
    id: 'late-credit',
    section: 'deadlines',
    order: 50,
    appliesWhen: (h) => usesXp(h) && h.lateCreditEnabled !== false,
    adultText: () =>
      `${lateTableAdult()} Applied the instant Complete is tapped — never recomputed.`,
    kidText: () => 'Finish late and you still get most of them.',
  },
  {
    id: 'expiry',
    section: 'deadlines',
    order: 60,
    appliesWhen: () => true,
    adultText: () =>
      `After 23:59 household-local, unfinished tasks become ${VOCAB.expired} and cannot be completed.`,
    kidText: () => 'After midnight, the task is gone.',
  },
  {
    id: 'streak-basics',
    section: 'streaks',
    order: 70,
    appliesWhen: (h) => h.streakEnabled !== false,
    adultText: () =>
      'Daily (and weekdays) tasks feed the streak. Weekly/monthly tasks do not break it.',
    kidText: () => 'Do every task, every day, and your streak grows.',
  },
  {
    id: 'streak-cliffs',
    section: 'streaks',
    order: 80,
    appliesWhen: (h) => h.streakEnabled !== false,
    adultText: () =>
      `Streak ends after ${ROLLING_MISS_LIMIT} consecutive misses, or ${ROLLING_MISS_LIMIT} misses in ${ROLLING_MISS_WINDOW_DAYS} days.`,
    kidText: () =>
      'Three misses and your streak is gone — in a row, or in a week.',
  },
  {
    id: 'streak-rescue',
    section: 'streaks',
    order: 90,
    appliesWhen: (h) => usesXp(h) && h.streakEnabled !== false,
    adultText: () => {
      const pct = Math.round(RESCUE_COST_PCT_PER_DAY * 100);
      const free = FIRST_RESCUE_IS_FREE
        ? ` The first ${VOCAB.streakRescue} is free after the member confirms the prompt.`
        : '';
      return `${VOCAB.streakRescue}: ${pct}% of week-to-date gross XP per rescued day (max ${MAX_RESCUABLE_CONSECUTIVE_DAYS} days).${free}`;
    },
    kidText: () => 'Miss once? You can trade some points to save it.',
  },
  {
    id: 'hygiene-streak',
    section: 'streaks',
    order: 100,
    appliesWhen: (h) => h.hygieneTrackedAsStreak !== false,
    adultText: (h) =>
      usesXp(h)
        ? `Hygiene habits track streaks only — they award 0 XP (no ${VOCAB.lateCredit}).`
        : 'Hygiene habits track streaks only — they do not earn allowance.',
    kidText: () => 'Brushing and similar habits grow your streak, not your points.',
  },
  {
    id: 'homework-proof',
    section: 'proof',
    order: 110,
    appliesWhen: (_h, m) => m?.homeworkProofRequired !== false,
    adultText: () => 'Homework may require a photo before an adult confirms.',
    kidText: () => 'Some homework needs a photo so a grown-up can check it.',
  },
  {
    id: 'recess',
    section: 'recess',
    order: 120,
    appliesWhen: (h) => h.recessEnabled !== false,
    adultText: () =>
      `${VOCAB.recess} pauses tasks and freezes streaks. Admins only. No tasks are queued while away.`,
    kidText: () => `On ${VOCAB.recess}, your streak stays safe and new jobs wait.`,
  },
  {
    id: 'crowns',
    section: 'crowns',
    order: 130,
    appliesWhen: (h) => usesXp(h) && h.crownsEnabled !== false,
    adultText: () =>
      `${VOCAB.weeksCrown} and ${VOCAB.monthlySovereign} rank on net ledger XP. Ties share medals (1,1,3). Members on ${VOCAB.recess} are excluded.`,
    kidText: () => 'Earn the most points in a week or month to wear the crown.',
  },
];

export function rulesFor(
  h: HouseRulesHousehold,
  m?: HouseRulesMember,
  voice: 'adult' | 'kid' = 'adult'
): { id: string; section: RuleSection; text: string }[] {
  return RULE_REGISTRY.filter((r) => r.appliesWhen(h, m))
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      id: r.id,
      section: r.section,
      text: voice === 'kid' ? r.kidText(h, m) : r.adultText(h, m),
    }));
}

export type CustomHouseRule = {
  id: string;
  body: string;
  sortOrder: number;
};

/** Cap: 500 chars, max 10. Display-only — must not alter mechanics. */
export const CUSTOM_HOUSE_RULE_MAX_LEN = 500;
export const CUSTOM_HOUSE_RULE_MAX_COUNT = 10;

export function validateCustomHouseRule(
  body: string,
  existingCount: number
): { ok: true; body: string } | { ok: false; message: string } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: 'Rule cannot be empty.' };
  if (trimmed.length > CUSTOM_HOUSE_RULE_MAX_LEN) {
    return { ok: false, message: `Keep it under ${CUSTOM_HOUSE_RULE_MAX_LEN} characters.` };
  }
  if (existingCount >= CUSTOM_HOUSE_RULE_MAX_COUNT) {
    return { ok: false, message: `Up to ${CUSTOM_HOUSE_RULE_MAX_COUNT} custom rules.` };
  }
  return { ok: true, body: trimmed };
}
