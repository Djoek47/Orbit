import type { ConditionKey, HouseRulesHouseholdView } from '@/lib/rules/types';

/** Normalize app rewardModel keys to JSON vocabulary. */
export function normalizeRewardModel(model: string | null | undefined): string {
  if (!model) return 'full_system';
  if (model === 'full') return 'full_system';
  return model;
}

const ALLOWANCE_MODELS = new Set(['allowance', 'xp_allowance', 'full_system']);
const REWARDS_MODELS = new Set(['xp_rewards', 'full_system']);

/**
 * Closed-set visibility resolver. One switch — no expression parser.
 * Mirror of the HTML reference `isVisible`.
 */
export function isVisible(condition: ConditionKey, household: HouseRulesHouseholdView): boolean {
  const model = normalizeRewardModel(household.rewardModel);
  switch (condition) {
    case 'ALWAYS':
      return true;
    case 'XP_ON':
      return model !== 'allowance';
    case 'ALLOWANCE_ON':
      return ALLOWANCE_MODELS.has(model);
    case 'REWARDS_ON':
      return REWARDS_MODELS.has(model);
    case 'MULTI_SIDEKICK':
      return household.sidekickCount >= 2;
    case 'SOLO_SIDEKICK':
      return household.sidekickCount === 1;
    case 'ALLOWANCE_REQUESTS_ON':
      return ALLOWANCE_MODELS.has(model) && household.allowanceRequestsEnabled === true;
    case 'HOMEWORK_ON':
      return household.homeworkEnabled === true;
    default: {
      throw new Error(`Unknown condition: ${String(condition)}`);
    }
  }
}

export function hasAllowanceModel(model: string | null | undefined): boolean {
  return ALLOWANCE_MODELS.has(normalizeRewardModel(model));
}
