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
import type { SavedPlaceKind } from '@/types/orbit';

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
      address: street || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
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
 * Ask Overpass, trying each mirror in turn. Always settles: on failure it returns [], so
 * the caller can say "nothing nearby" instead of spinning for ever.
 */
export async function findNearbySuggestions(origin: {
  lat: number;
  lng: number;
}): Promise<NearbySuggestion[]> {
  const query = nearbyQuery(origin.lat, origin.lng);
  for (const url of OVERPASS_MIRRORS) {
    try {
      const elements = await askOverpass(url, query);
      if (elements.length) return suggestionsFromElements(elements, origin);
    } catch (error) {
      console.warn('findNearbySuggestions', url, error);
    }
  }
  return [];
}
