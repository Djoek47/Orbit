import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@orbit/itinerary_favorites';

export async function loadFavoriteItineraryIds(
  householdId: string | null | undefined
): Promise<string[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteItineraryIds(
  householdId: string | null | undefined,
  ids: string[]
): Promise<void> {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify([...new Set(ids)]));
  } catch (error) {
    console.warn('saveFavoriteItineraryIds failed', error);
  }
}
