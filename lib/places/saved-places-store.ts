import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedPlace } from '@/types/orbit';

const KEY = '@orbit/household_saved_places.v1';

export async function loadLocalSavedPlaces(
  householdId: string | null | undefined
): Promise<SavedPlace[] | null> {
  if (!householdId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlace[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveLocalSavedPlaces(
  householdId: string | null | undefined,
  places: SavedPlace[]
): Promise<void> {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify(places));
  } catch (error) {
    console.warn('saveLocalSavedPlaces failed', error);
  }
}
