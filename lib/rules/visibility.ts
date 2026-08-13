import type { ConditionKey, HouseRulesHouseholdView } from '@/lib/rules/types';

/** Normalize app rewardModel keys to JSON vocabulary. */
export function normalizeRewardModel(model: string | null | undefined): string {
  if (!model) return 'full_system';
  if (model === 'full') return 'full_system';
  return model;
}

/**
 * Closed-set visibility resolver. One switch — no expression parser.
 */
export function isVisible(
  condition: ConditionKey,
  household: HouseRulesHouseholdView
): boolean {
  const model = normalizeRewardModel(household.rewardModel);
  switch (condition) {
    case 'ALWAYS':
      return true;
    case 'XP_ON':
      return model !== 'allowance';
    case 'ALLOWANCE_ON':
      return model === 'allowance' || model === 'xp_allowance' || model === 'full_system';
    case 'REWARDS_ON':
      return model === 'xp_rewards' || model === 'full_system';
    case 'MULTI_MEMBER':
      return household.helperCount >= 2 && model !== 'allowance';
    case 'HOMEWORK_ON':
      return household.homeworkEnabled === true;
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}
