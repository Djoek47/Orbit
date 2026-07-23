import * as Location from 'expo-location';

import { PREFERRED_STORES } from '@/data/preferred-stores';
import type { PreferredStore } from '@/types/orbit';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 4000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchOsmStores(lat: number, lng: number): Promise<PreferredStore[]> {
  const query = `
    [out:json][timeout:12];
    (
      node["shop"="supermarket"](around:${RADIUS_M},${lat},${lng});
      node["shop"="convenience"](around:${RADIUS_M},${lat},${lng});
      way["shop"="supermarket"](around:${RADIUS_M},${lat},${lng});
      way["shop"="convenience"](around:${RADIUS_M},${lat},${lng});
    );
    out center 20;
  `;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error(`Overpass ${response.status}`);
  }
  const json = (await response.json()) as { elements?: OverpassElement[] };
  const elements = json.elements ?? [];
  const stores: PreferredStore[] = [];
  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (elLat == null || elLng == null) continue;
    const name = el.tags?.name || el.tags?.brand || 'Grocery store';
    const address =
      [el.tags?.['addr:housenumber'], el.tags?.['addr:street']].filter(Boolean).join(' ') ||
      `${elLat.toFixed(4)}, ${elLng.toFixed(4)}`;
    stores.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      address,
      placeQuery: `${name} ${address}`,
      lat: elLat,
      lng: elLng,
      distanceMeters: Math.round(haversineMeters(lat, lng, elLat, elLng)),
      source: 'osm',
    });
  }
  return stores.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

function curatedNear(lat: number, lng: number): PreferredStore[] {
  return PREFERRED_STORES.map((store) => ({
    ...store,
    distanceMeters:
      store.lat != null && store.lng != null
        ? Math.round(haversineMeters(lat, lng, store.lat, store.lng))
        : undefined,
  })).sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
}

/**
 * Nearby grocery stores via OSM Overpass + curated mock fallback.
 * Expo Go friendly — no API key.
 */
export async function findNearbyStores(): Promise<{
  stores: PreferredStore[];
  coords: { lat: number; lng: number } | null;
  source: 'osm' | 'curated' | 'denied';
}> {
  const coords = await getCurrentCoords();
  if (!coords) {
    return {
      stores: PREFERRED_STORES.map((s) => ({ ...s })),
      coords: null,
      source: 'denied',
    };
  }

  try {
    const osm = await fetchOsmStores(coords.lat, coords.lng);
    if (osm.length > 0) {
      return { stores: osm, coords, source: 'osm' };
    }
  } catch (error) {
    console.warn('findNearbyStores OSM failed', error);
  }

  return {
    stores: curatedNear(coords.lat, coords.lng),
    coords,
    source: 'curated',
  };
}

/** True when a shop is within `withinMeters` of any stop that has coords. */
export function shopNearStops(
  shop: { lat?: number; lng?: number },
  stops: { lat?: number; lng?: number }[],
  withinMeters = 1200
): boolean {
  if (shop.lat == null || shop.lng == null) return false;
  return stops.some((stop) => {
    if (stop.lat == null || stop.lng == null) return false;
    return haversineMeters(shop.lat!, shop.lng!, stop.lat, stop.lng) <= withinMeters;
  });
}
