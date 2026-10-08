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

// ── Where "near home" is ──────────────────────────────────────────────────────
// The suggestion cache is keyed by origin coordinates, which means nothing can be read from
// it until the origin is known. When Home was typed rather than dropped it has no lat/lng, so
// every single open geocoded the address over the network first — a week-long cache sitting
// behind a fresh network round trip. The origin is the slow part, so it is cached too.

const ORIGIN_KEY = 'orbit.nearby-origin.v1';
/** Longer than the store TTL: a home address resolves to the same point indefinitely. */
const ORIGIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type OriginEnvelope = {
  /** The address it was resolved from, so a move invalidates it. */
  source: string;
  savedAt: number;
  lat: number;
  lng: number;
};

export async function loadCachedOrigin(
  source: string
): Promise<{ lat: number; lng: number } | null> {
  if (!source.trim()) return null;
  try {
    const raw = await AsyncStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OriginEnvelope;
    if (parsed?.source !== source.trim()) return null;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    if (Date.now() - (parsed.savedAt ?? 0) > ORIGIN_TTL_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

export async function saveCachedOrigin(
  source: string,
  origin: { lat: number; lng: number }
): Promise<void> {
  if (!source.trim()) return;
  try {
    const payload: OriginEnvelope = {
      source: source.trim(),
      savedAt: Date.now(),
      lat: origin.lat,
      lng: origin.lng,
    };
    await AsyncStorage.setItem(ORIGIN_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('nearby-cache origin write', error);
  }
}

// ── What was on screen last time ──────────────────────────────────────────────
// Even with both caches warm there are two awaits before anything paints, so the row still
// opened on a spinner. This holds the last set actually shown, under no key at all, so the
// row can paint on the first frame and correct itself a moment later if the origin moved.

const LAST_SHOWN_KEY = 'orbit.nearby-last-shown.v1';

export async function loadLastShownSuggestions(): Promise<NearbySuggestion[] | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; items: NearbySuggestion[] };
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

export async function saveLastShownSuggestions(items: NearbySuggestion[]): Promise<void> {
  if (!items.length) return;
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, JSON.stringify({ savedAt: Date.now(), items }));
  } catch (error) {
    console.warn('nearby-cache last-shown write', error);
  }
}
