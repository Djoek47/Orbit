/**
 * ChoreMaxx v2 reward model — single enum + derived capabilities.
 * Spec: docs/logic/choremaxx-v2-cursor-spec.md §2.2
 *
 * Every XP / rewards / allowance surface MUST read CAPABILITIES[rewardModel],
 * never a scattered per-screen boolean.
 */

export type RewardModel =
  | 'xp_only'
  | 'allowance'
  | 'xp_rewards'
  | 'xp_allowance'
  | 'full';

export type ScoringMode = 'meritocracy' | 'equity';

export type RewardModelCapabilities = {
  xpEnabled: boolean;
  rewardsEnabled: boolean;
  allowanceEnabled: boolean;
};

export const REWARD_MODEL_CAPABILITIES: Record<RewardModel, RewardModelCapabilities> = {
  xp_only: { xpEnabled: true, rewardsEnabled: false, allowanceEnabled: false },
  allowance: { xpEnabled: false, rewardsEnabled: false, allowanceEnabled: true },
  xp_rewards: { xpEnabled: true, rewardsEnabled: true, allowanceEnabled: false },
  xp_allowance: { xpEnabled: true, rewardsEnabled: false, allowanceEnabled: true },
  full: { xpEnabled: true, rewardsEnabled: true, allowanceEnabled: true },
};

/** Option 5 is the recommended default (§2.1). */
export const DEFAULT_REWARD_MODEL: RewardModel = 'full';

export const REWARD_MODEL_OPTIONS: {
  id: RewardModel;
  title: string;
  subtitle: string;
  recommended?: boolean;
}[] = [
  {
    id: 'xp_only',
    title: 'XP only',
    subtitle: 'Levels and streaks that celebrate effort',
  },
  {
    id: 'allowance',
    title: 'Allowance',
    subtitle: 'Real money for real help',
  },
  {
    id: 'xp_rewards',
    title: 'XP + Rewards',
    subtitle: 'Points that unlock real-life privileges',
  },
  {
    id: 'xp_allowance',
    title: 'XP + Allowance',
    subtitle: 'Levels and money together',
  },
  {
    id: 'full',
    title: 'ChoreMaxx Full System',
    subtitle: 'Allowance, XP and rewards — everything on',
    recommended: true,
  },
];

export function capabilitiesFor(model: RewardModel | null | undefined): RewardModelCapabilities {
  return REWARD_MODEL_CAPABILITIES[model ?? DEFAULT_REWARD_MODEL];
}

/**
 * Migration helpers (§2.2):
 * - no_rewards → xp_only
 * - custom → closest of five; ambiguous → full
 */
export function migrateLegacyRewardModel(input: {
  legacy?: string | null;
  xpEnabled?: boolean;
  rewardsEnabled?: boolean;
  allowanceEnabled?: boolean;
}): RewardModel {
  const legacy = (input.legacy ?? '').toLowerCase();
  if (legacy === 'no_rewards' || legacy === 'xp_only') return 'xp_only';
  if (legacy === 'allowance') return 'allowance';
  if (legacy === 'xp_rewards') return 'xp_rewards';
  if (legacy === 'xp_allowance') return 'xp_allowance';
  if (legacy === 'full') return 'full';
  if (legacy === 'custom') {
    const xp = Boolean(input.xpEnabled);
    const rewards = Boolean(input.rewardsEnabled);
    const allowance = Boolean(input.allowanceEnabled);
    if (xp && rewards && allowance) return 'full';
    if (xp && rewards && !allowance) return 'xp_rewards';
    if (xp && !rewards && allowance) return 'xp_allowance';
    if (!xp && !rewards && allowance) return 'allowance';
    if (xp && !rewards && !allowance) return 'xp_only';
    return 'full'; // TODO(product): ambiguous custom → full
  }
  return DEFAULT_REWARD_MODEL;
}
