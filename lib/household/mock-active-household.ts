/**
 * Persist the active mock household so create/join survives Expo Go reload.
 * Demo Rivera (`hh-rivera`) remains the default when nothing is stored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HouseholdSnapshot } from '@/types/orbit';

const KEY = '@orbit/mock_active_household.v1';

export async function loadActiveMockHousehold(): Promise<HouseholdSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseholdSnapshot;
    if (!parsed?.id || !Array.isArray(parsed.members)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveActiveMockHousehold(household: HouseholdSnapshot): Promise<void> {
  if (!household.id) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(household));
  } catch (error) {
    console.warn('saveActiveMockHousehold failed', error);
  }
}

export async function clearActiveMockHousehold(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (error) {
    console.warn('clearActiveMockHousehold failed', error);
  }
}
