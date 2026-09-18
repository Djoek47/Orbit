import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AllowanceGrant } from '@/types/orbit';

const KEY = '@orbit/mock_allowances.v1';

export async function loadAllowances(
  householdId: string | null | undefined
): Promise<AllowanceGrant[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AllowanceGrant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAllowances(
  householdId: string | null | undefined,
  items: AllowanceGrant[]
): Promise<void> {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify(items));
  } catch (error) {
    console.warn('saveAllowances failed', error);
  }
}
