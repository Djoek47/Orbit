/**
 * Household reward mode — Meritocracy (weighted) vs Equity (flat).
 * Spec: docs/logic/choremaxx-reward-mode-cursor-spec.md
 *
 * THE ONE RULE: hygiene / streak tasks are outside the mode system.
 * Eligibility is checked BEFORE any mode branch. Never apply FLAT_TASK_XP
 * to xpEligible: false.
 */

export type RewardMode = 'weighted' | 'flat';

export const FLAT_TASK_XP = 10;

export const XP_LADDER = [5, 10, 15, 20, 25, 30] as const;
export type XpRung = (typeof XP_LADDER)[number];

export const HYGIENE_XP_OPTIONS = [5, 10] as const;
export type HygieneXp = (typeof HYGIENE_XP_OPTIONS)[number];

export type HouseholdRewardSettings = {
  rewardMode: RewardMode;
  hygieneRewarded: boolean;
  hygieneXp: HygieneXp;
};

export const DEFAULT_HOUSEHOLD_REWARD_SETTINGS: HouseholdRewardSettings = {
  rewardMode: 'weighted',
  hygieneRewarded: false,
  hygieneXp: 5,
};

export const REWARD_MODE_COPY: Record<RewardMode, { label: string; blurb: string }> = {
  weighted: {
    label: 'Meritocracy',
    blurb: 'Harder, longer tasks are worth more points.',
  },
  flat: {
    label: 'Equity',
    blurb: 'Every chore is worth the same, no matter the effort.',
  },
};

export const STREAK_FOOTNOTE = 'Hygiene tasks are tracked as streaks, not points.';
export const STREAK_FOOTNOTE_REWARDED = (xp: number) =>
  `Hygiene tasks are tracked as streaks and earn a flat ${xp} XP.`;

export const REWARD_MODE_EXAMPLES: Record<
  RewardMode,
  { task: string; xp: number }[]
> = {
  weighted: [
    { task: 'Mow the lawn', xp: 30 },
    { task: 'Take out the trash', xp: 10 },
    { task: 'Feed the pet', xp: 5 },
  ],
  flat: [
    { task: 'Mow the lawn', xp: 10 },
    { task: 'Take out the trash', xp: 10 },
    { task: 'Feed the pet', xp: 10 },
  ],
};

export type XpContext = {
  mode: RewardMode;
  hygieneRewarded: boolean;
  hygieneXp: number;
};

export type LibraryXpFields = {
  baseXp: number;
  xpEligible: boolean;
};

/** Derive eligibility: streak / hygiene tasks are never mode-eligible. */
export function isXpEligible(task: {
  tracking?: 'xp' | 'streak';
  category?: string;
  xpEligible?: boolean;
}): boolean {
  if (typeof task.xpEligible === 'boolean') return task.xpEligible;
  if (task.tracking === 'streak') return false;
  if (task.category === 'Hygiene') return false;
  return true;
}

/**
 * Resolve display / award XP at read time.
 * Never mutate baseXp. Mode is never read inside the ineligible branch.
 */
export function resolveTaskXp(
  task: Pick<LibraryXpFields, 'baseXp' | 'xpEligible'>,
  ctx: XpContext
): number {
  if (!task.xpEligible) {
    return ctx.hygieneRewarded ? ctx.hygieneXp : 0;
  }
  return ctx.mode === 'flat' ? FLAT_TASK_XP : task.baseXp;
}

export function resolveTaskXpFromHouseholdTask(
  task: {
    xp: number;
    baseXp?: number;
    tracking?: 'xp' | 'streak';
    category?: string;
    xpEligible?: boolean;
  },
  settings: HouseholdRewardSettings
): number {
  const eligible = isXpEligible(task);
  const baseXp = eligible ? (task.baseXp ?? task.xp) : 0;
  return resolveTaskXp(
    { baseXp, xpEligible: eligible },
    {
      mode: settings.rewardMode,
      hygieneRewarded: settings.hygieneRewarded,
      hygieneXp: settings.hygieneXp,
    }
  );
}

export function normalizeHygieneXp(value: number): HygieneXp {
  return value >= 10 ? 10 : 5;
}

export function normalizeRewardSettings(
  partial?: Partial<HouseholdRewardSettings> | null
): HouseholdRewardSettings {
  return {
    rewardMode: partial?.rewardMode === 'flat' ? 'flat' : 'weighted',
    hygieneRewarded: Boolean(partial?.hygieneRewarded),
    hygieneXp: normalizeHygieneXp(partial?.hygieneXp ?? 5),
  };
}

export function isLadderXp(value: number): value is XpRung {
  return (XP_LADDER as readonly number[]).includes(value);
}

export const XP_LADDER_LABELS: Record<XpRung, string> = {
  5: 'Under 5 minutes — 5 XP',
  10: '5–15 minutes — 10 XP',
  15: '15–30 minutes — 15 XP',
  20: '30–45 minutes — 20 XP',
  25: '45–60 minutes — 25 XP',
  30: 'Over an hour — 30 XP',
};
