/**
 * Persist nearby OSM stores so Places / New trip don't re-hit Overpass on every open.
 * Cache is keyed by rounded origin coords (~1.1 km cells).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PreferredStore } from '@/types/orbit';
import type { NearbySuggestion } from '@/lib/places/nearby-suggestions';

const STORES_KEY = 'orbit.nearby-stores.v1';
const SUGGESTIONS_KEY = 'orbit.nearby-suggestions.v1';
/** Keep for a week — shops don't move; refresh still available on demand. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEnvelope<T> = {
  originKey: string;
  savedAt: number;
  items: T[];
};

export function nearbyOriginKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function readCache<T>(key: string, originKey: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.originKey || !Array.isArray(parsed.items)) return null;
    if (parsed.originKey !== originKey) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, originKey: string, items: T[]): Promise<void> {
  try {
    const payload: CacheEnvelope<T> = { originKey, savedAt: Date.now(), items };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('nearby-cache write', error);
  }
}

export async function loadCachedNearbyStores(
  lat: number,
  lng: number
): Promise<PreferredStore[] | null> {
  return readCache<PreferredStore>(STORES_KEY, nearbyOriginKey(lat, lng));
}

export async function saveCachedNearbyStores(
  lat: number,
  lng: number,
  stores: PreferredStore[]
): Promise<void> {
  if (!stores.length) return;
  await writeCache(STORES_KEY, nearbyOriginKey(lat, lng), stores);
}

export async function loadCachedNearbySuggestions(
  lat: number,
  lng: number
): Promise<NearbySuggestion[] | null> {
  return readCache<NearbySuggestion>(SUGGESTIONS_KEY, nearbyOriginKey(lat, lng));
}

export async function saveCachedNearbySuggestions(
  lat: number,
  lng: number,
  items: NearbySuggestion[]
): Promise<void> {
  if (!items.length) return;
  await writeCache(SUGGESTIONS_KEY, nearbyOriginKey(lat, lng), items);
}
