/**
 * Curated reward bundles for Get Started — cute, obvious, always populate a minimum vault.
 */

import type { DraftMemberReward } from '@/lib/onboarding/setup-draft';
import { REWARD_PRESETS, type RewardFrequency } from '@/lib/rewards/reward-presets';

export type RewardPackageId =
  | 'pack-starter'
  | 'pack-treat-time'
  | 'pack-game-on'
  | 'pack-pick-play';

export type RewardPackageItem = {
  presetId: string;
  frequency?: RewardFrequency;
  quantity?: string;
};

export type RewardPackage = {
  id: RewardPackageId;
  emoji: string;
  title: string;
  tagline: string;
  /** Short chips shown on the card — plain language, no jargon. */
  highlights: string[];
  recommended?: boolean;
  items: RewardPackageItem[];
};

export const DEFAULT_REWARD_PACKAGE_ID: RewardPackageId = 'pack-starter';

export const REWARD_PACKAGES: RewardPackage[] = [
  {
    id: 'pack-starter',
    emoji: '✨',
    title: 'Starter pack',
    tagline: 'Three gentle wins to begin with',
    highlights: ['Dessert pick', '30 min screens', 'Movie night'],
    recommended: true,
    items: [
      { presetId: 'preset-dessert', frequency: 'daily' },
      { presetId: 'preset-screen-time', frequency: 'daily', quantity: '30 min' },
      { presetId: 'preset-choose-movie', frequency: 'weekly' },
    ],
  },
  {
    id: 'pack-treat-time',
    emoji: '🍪',
    title: 'Treat time',
    tagline: 'Sweet choices they can look forward to',
    highlights: ['Dessert pick', 'Breakfast pick'],
    items: [
      { presetId: 'preset-dessert', frequency: 'daily' },
      { presetId: 'preset-choose-breakfast', frequency: 'weekly' },
    ],
  },
  {
    id: 'pack-game-on',
    emoji: '🎮',
    title: 'Game on',
    tagline: 'Screen time earned, not given',
    highlights: ['30 min screens', 'Game time'],
    items: [
      { presetId: 'preset-screen-time', frequency: 'daily', quantity: '30 min' },
      { presetId: 'preset-video-game-time', frequency: 'daily', quantity: '30 min' },
    ],
  },
  {
    id: 'pack-pick-play',
    emoji: '🎬',
    title: 'Pick & play',
    tagline: 'They choose the family fun',
    highlights: ['Movie night', 'Dinner pick'],
    items: [
      { presetId: 'preset-choose-movie', frequency: 'weekly' },
      { presetId: 'preset-choose-dinner', frequency: 'weekly' },
    ],
  },
];

const byId = new Map(REWARD_PACKAGES.map((pack) => [pack.id, pack]));

export function rewardPackageById(id: string | null | undefined): RewardPackage | null {
  if (!id) return null;
  return byId.get(id as RewardPackageId) ?? null;
}

export function draftRewardsFromPackage(
  packageId: string | null | undefined = DEFAULT_REWARD_PACKAGE_ID
): DraftMemberReward[] {
  const pack = rewardPackageById(packageId) ?? byId.get(DEFAULT_REWARD_PACKAGE_ID)!;
  const rewards: DraftMemberReward[] = [];
  for (const item of pack.items) {
    const preset = REWARD_PRESETS.find((p) => p.id === item.presetId);
    if (!preset) continue;
    rewards.push({
      presetId: preset.id,
      title: preset.title,
      frequency: item.frequency ?? preset.defaultFrequency,
      quantity: item.quantity ?? preset.quantityOptions?.[0],
    });
  }
  return rewards;
}

export function rewardsMatchPackage(
  rewards: DraftMemberReward[],
  packageId: string | null | undefined
): boolean {
  const expected = draftRewardsFromPackage(packageId);
  if (rewards.length !== expected.length) return false;
  const rewardIds = new Set(rewards.map((r) => r.presetId));
  return expected.every((item) => rewardIds.has(item.presetId));
}
