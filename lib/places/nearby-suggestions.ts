/**
 * "Places near home" — what Poppins offers when you add a place.
 *
 * Looks around Home (or, before Home exists, around you) and comes back with the everyday
 * places a household actually saves: grocery stores, pharmacies, schools, parks and
 * playgrounds, gyms, cafés and libraries. One tap saves it with the right kind, so trips can
 * say "school" and mean it.
 *
 * Data is OpenStreetMap via Overpass — the same source the nearby-store watcher uses.
 */
import { haversineMeters } from '@/lib/places/geo-distance';
import {
  loadCachedNearbySuggestions,
  saveCachedNearbySuggestions,
} from '@/lib/places/nearby-cache';
import type { PreferredStore, SavedPlaceKind } from '@/types/orbit';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 3000;

export type NearbySuggestion = {
  /** Stable id from the OSM element, so re-runs don't duplicate. */
  id: string;
  name: string;
  address: string;
  kind: SavedPlaceKind;
  emoji: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  /** "Grocery · 700 m" for the card. */
  detail: string;
};

export type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** OSM tag → the kind a household would file it under. Order matters: first match wins. */
const RULES: { key: string; values: string[]; kind: SavedPlaceKind; emoji: string; label: string }[] = [
  { key: 'shop', values: ['supermarket', 'greengrocer', 'convenience'], kind: 'shop', emoji: '🛒', label: 'Grocery' },
  { key: 'shop', values: ['clothes', 'shoes', 'department_store'], kind: 'clothing', emoji: '👕', label: 'Clothing' },
  { key: 'amenity', values: ['pharmacy'], kind: 'pickup', emoji: '💊', label: 'Pharmacy' },
  { key: 'amenity', values: ['school', 'kindergarten', 'college'], kind: 'school', emoji: '🏫', label: 'School' },
  { key: 'amenity', values: ['library'], kind: 'custom', emoji: '📚', label: 'Library' },
  { key: 'amenity', values: ['cafe'], kind: 'cafe', emoji: '☕', label: 'Café' },
  { key: 'leisure', values: ['playground'], kind: 'practice', emoji: '🛝', label: 'Playground' },
  { key: 'leisure', values: ['fitness_centre', 'sports_centre', 'swimming_pool'], kind: 'practice', emoji: '🏋️', label: 'Gym' },
  { key: 'leisure', values: ['park', 'pitch'], kind: 'practice', emoji: '🌳', label: 'Park' },
];

/** The Overpass query for one point — every rule, in one round trip. */
export function nearbyQuery(lat: number, lng: number, radiusM = RADIUS_M): string {
  const clauses = RULES.flatMap((rule) =>
    ['node', 'way'].map(
      (type) => `${type}["${rule.key}"~"^(${rule.values.join('|')})$"](around:${radiusM},${lat},${lng});`
    )
  ).join('\n      ');
  return `
    [out:json][timeout:15];
    (
      ${clauses}
    );
    out center 90;
  `;
}

function metersLabel(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Turn Overpass elements into cards, nearest first. Unnamed and far-flung rows are dropped. */
export function suggestionsFromElements(
  elements: OverpassElement[],
  origin: { lat: number; lng: number }
): NearbySuggestion[] {
  const out: NearbySuggestion[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name?.trim();
    if (lat == null || lng == null || !name) continue;

    const rule = RULES.find((r) => r.values.includes((el.tags?.[r.key] ?? '').toLowerCase()));
    if (!rule) continue;

    // The same shop mapped as both a node and a building shouldn't show twice.
    const dedupe = `${name.toLowerCase()}|${rule.kind}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const distanceMeters = Math.round(haversineMeters(origin.lat, origin.lng, lat, lng));
    const street = [el.tags?.['addr:housenumber'], el.tags?.['addr:street']].filter(Boolean).join(' ');
    out.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      // Prefer a real street; never fall back to raw coords (trip UI hides those).
      address: street,
      kind: rule.kind,
      emoji: rule.emoji,
      lat,
      lng,
      distanceMeters,
      detail: `${rule.label} · ${metersLabel(distanceMeters)}`,
    });
  }

  return out.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Drop what's already saved, and keep a mix rather than ten supermarkets. */
export function pickSuggestions(
  all: NearbySuggestion[],
  savedNames: string[],
  limit = 8
): NearbySuggestion[] {
  const saved = new Set(savedNames.map((name) => name.trim().toLowerCase()));
  const fresh = all.filter((s) => !saved.has(s.name.toLowerCase()));
  const perKind = new Map<SavedPlaceKind, number>();
  const picked: NearbySuggestion[] = [];

  // Two per kind first, so the list is varied; then fill up with whatever is nearest.
  for (const suggestion of fresh) {
    const count = perKind.get(suggestion.kind) ?? 0;
    if (count >= 2) continue;
    perKind.set(suggestion.kind, count + 1);
    picked.push(suggestion);
    if (picked.length >= limit) return picked;
  }
  for (const suggestion of fresh) {
    if (picked.length >= limit) break;
    if (!picked.includes(suggestion)) picked.push(suggestion);
  }
  return picked;
}

/** Overpass is a free service and can hang. Never leave the row spinning. */
const REQUEST_TIMEOUT_MS = 12_000;
/** Mirrors, tried in turn — one instance being down is the usual failure. */
const OVERPASS_MIRRORS = [
  OVERPASS_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

async function askOverpass(url: string, query: string): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    const json = (await response.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Overpass, trying each mirror in turn. Cached after the first successful hit so
 * Places doesn't re-fetch every open. Pass forceRefresh to bypass (refresh button).
 */
export async function findNearbySuggestions(
  origin: {
    lat: number;
    lng: number;
  },
  options?: { forceRefresh?: boolean }
): Promise<NearbySuggestion[]> {
  if (!options?.forceRefresh) {
    const cached = await loadCachedNearbySuggestions(origin.lat, origin.lng);
    if (cached?.length) return cached;
  }
  const query = nearbyQuery(origin.lat, origin.lng);
  for (const url of OVERPASS_MIRRORS) {
    try {
      const elements = await askOverpass(url, query);
      if (elements.length) {
        const found = suggestionsFromElements(elements, origin);
        if (found.length) {
          await saveCachedNearbySuggestions(origin.lat, origin.lng, found);
          return found;
        }
      }
    } catch (error) {
      console.warn('findNearbySuggestions', url, error);
    }
  }
  const cached = await loadCachedNearbySuggestions(origin.lat, origin.lng);
  return cached ?? [];
}

/**
 * The same shops New trip lists, as suggestion cards.
 *
 * New trip and Add place asked two different services. New trip's answered; this one's often
 * didn't, so Places sat on "Couldn't find places near home" while the trip screen listed eight
 * stores from the same spot. When the richer search comes back empty, these fill in — and being
 * ordinary suggestions, they save as places like any other.
 */
export function suggestionsFromStores(
  stores: PreferredStore[],
  origin: { lat: number; lng: number }
): NearbySuggestion[] {
  const out: NearbySuggestion[] = [];
  for (const store of stores) {
    const name = store.name?.trim();
    if (!name || store.lat == null || store.lng == null) continue;
    const distanceMeters =
      store.distanceMeters ?? haversineMeters(origin.lat, origin.lng, store.lat, store.lng);
    const kind: SavedPlaceKind = store.shopKind === 'clothing' ? 'clothing' : 'shop';
    out.push({
      id: store.id,
      name,
      address: store.address?.trim() || name,
      kind,
      emoji: store.shopKind === 'clothing' ? '👕' : '🛒',
      lat: store.lat,
      lng: store.lng,
      distanceMeters,
      detail: `${store.shopKind === 'clothing' ? 'Clothing' : 'Store'} · ${metersLabel(distanceMeters)}`,
    });
  }
  return out.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
