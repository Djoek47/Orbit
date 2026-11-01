/**
 * Persist the active mock household so create/join survives Expo Go reload.
 * Demo Rivera (`hh-rivera`) remains the default when nothing is stored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { dataMode } from '@/config/data-mode';
import type { HouseholdSnapshot } from '@/types/orbit';

const KEY = '@orbit/mock_active_household.v1';

export async function loadActiveMockHousehold(): Promise<HouseholdSnapshot | null> {
  // Demo data only exists in demo mode. On a real account this used to hand back a demo
  // household left on the phone (Emma, Jack…) whenever loading the real one failed, and those
  // people showed up on the shared device's "Who's using this device?".
  if (dataMode !== 'mock') {
    void clearActiveMockHousehold();
    return null;
  }
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
  if (!household.id || dataMode !== 'mock') return;
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
