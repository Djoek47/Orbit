/**
 * Local overlay for reward fields Supabase schema may not persist yet
 * (emoji, category, assignee, origin, …). Rehydrated after getRewards.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Reward } from '@/types/orbit';

const KEY = '@orbit/reward_field_overlay.v1';

export type RewardFieldOverlay = Pick<
  Reward,
  | 'emoji'
  | 'category'
  | 'color'
  | 'specialRequest'
  | 'origin'
  | 'createdByMemberId'
  | 'createdByName'
  | 'assignedMemberId'
  | 'assignedMemberName'
  | 'archived'
>;

export async function loadRewardFieldOverlay(
  householdId: string | null | undefined
): Promise<Record<string, RewardFieldOverlay>> {
  if (!householdId) return {};
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RewardFieldOverlay>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveRewardFieldOverlay(
  householdId: string | null | undefined,
  rewardId: string,
  fields: RewardFieldOverlay
): Promise<void> {
  if (!householdId || !rewardId) return;
  try {
    const current = await loadRewardFieldOverlay(householdId);
    current[rewardId] = { ...current[rewardId], ...fields };
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify(current));
  } catch (error) {
    console.warn('saveRewardFieldOverlay failed', error);
  }
}

export function mergeRewardOverlay(
  rewards: Reward[],
  overlay: Record<string, RewardFieldOverlay>
): Reward[] {
  return rewards.map((reward) => {
    const extra = overlay[reward.id];
    return extra ? { ...reward, ...extra } : reward;
  });
}
