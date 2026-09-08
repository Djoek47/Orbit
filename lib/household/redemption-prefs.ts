import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RewardRedemption } from '@/types/orbit';

const KEY = '@orbit/mock_redemptions.v1';

export async function loadRedemptions(
  householdId: string | null | undefined
): Promise<RewardRedemption[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RewardRedemption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRedemptions(
  householdId: string | null | undefined,
  items: RewardRedemption[]
): Promise<void> {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify(items));
  } catch (error) {
    console.warn('saveRedemptions failed', error);
  }
}
