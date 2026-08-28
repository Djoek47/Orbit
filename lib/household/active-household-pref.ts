/**
 * Persist which household is active when a user belongs to more than one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_KEY = '@orbit/activeHouseholdId';
const PRIMARY_KEY = '@orbit/primaryHouseholdId';

export async function getActiveHouseholdPref(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function setActiveHouseholdPref(householdId: string | null): Promise<void> {
  try {
    if (!householdId?.trim()) {
      await AsyncStorage.removeItem(ACTIVE_KEY);
      return;
    }
    await AsyncStorage.setItem(ACTIVE_KEY, householdId.trim());
  } catch (error) {
    console.warn('setActiveHouseholdPref failed', error);
  }
}

export async function getPrimaryHouseholdPref(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PRIMARY_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function setPrimaryHouseholdPref(householdId: string | null): Promise<void> {
  try {
    if (!householdId?.trim()) {
      await AsyncStorage.removeItem(PRIMARY_KEY);
      return;
    }
    await AsyncStorage.setItem(PRIMARY_KEY, householdId.trim());
  } catch (error) {
    console.warn('setPrimaryHouseholdPref failed', error);
  }
}
