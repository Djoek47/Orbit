import * as Location from 'expo-location';

import { haversineMeters } from '@/lib/places/geo-distance';
import {
  loadCachedNearbyStores,
  saveCachedNearbyStores,
} from '@/lib/places/nearby-cache';
import { shopKindFromOsmTag } from '@/lib/places/shop-kind';
import type { PreferredStore } from '@/types/orbit';

export { haversineMeters };

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 4000;

export async function getLocationPermission(): Promise<Location.PermissionStatus> {
  const current = await Location.getForegroundPermissionsAsync();
  return current.status;
}

/**
 * Coordinates for a typed address. Home is often saved from a search with no pin, and the
 * nearby lookup needs a point to search around.
 */
export async function coordsForAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const query = address.trim();
  if (!query) return null;
  try {
    const [hit] = await Location.geocodeAsync(query);
    if (!hit) return null;
    return { lat: hit.latitude, lng: hit.longitude };
  } catch (error) {
    console.warn('coordsForAddress', error);
    return null;
  }
}

export async function getCurrentCoords(options?: {
  requestIfNeeded?: boolean;
}): Promise<{ lat: number; lng: number } | null> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (!existing.granted) {
      if (options?.requestIfNeeded === false) return null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return null;
    }
    const last = await Location.getLastKnownPositionAsync();
    if (last?.coords) {
      return { lat: last.coords.latitude, lng: last.coords.longitude };
    }
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

function streetAddress(tags?: Record<string, string>): string {
  return [tags?.['addr:housenumber'], tags?.['addr:street']].filter(Boolean).join(' ').trim();
}

async function fetchOsmStores(lat: number, lng: number): Promise<PreferredStore[]> {
  const query = `
    [out:json][timeout:12];
    (
      node["shop"~"supermarket|convenience|greengrocer|clothes|shoes|department_store|mall|fashion"](around:${RADIUS_M},${lat},${lng});
      way["shop"~"supermarket|convenience|greengrocer|clothes|shoes|department_store|mall|fashion"](around:${RADIUS_M},${lat},${lng});
    );
    out center 28;
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
    const kind = shopKindFromOsmTag(el.tags?.shop) ?? 'retail';
    const name =
      el.tags?.name || el.tags?.brand || (kind === 'clothing' ? 'Clothing store' : 'Store');
    // Never stuff raw lat/lng into address — maps use lat/lng fields; UI hides coords.
    const address = streetAddress(el.tags);
    stores.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      address,
      placeQuery: address ? `${name} ${address}` : name,
      lat: elLat,
      lng: elLng,
      distanceMeters: Math.round(haversineMeters(lat, lng, elLat, elLng)),
      source: 'osm',
      shopKind: kind,
    });
  }
  return stores.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

export async function findNearbyStoresAt(
  lat: number,
  lng: number,
  options?: { forceRefresh?: boolean }
): Promise<{ stores: PreferredStore[]; source: 'osm' | 'cache' | 'none' }> {
  if (!options?.forceRefresh) {
    const cached = await loadCachedNearbyStores(lat, lng);
    if (cached?.length) return { stores: cached, source: 'cache' };
  }
  try {
    const osm = await fetchOsmStores(lat, lng);
    if (osm.length > 0) {
      await saveCachedNearbyStores(lat, lng, osm);
      return { stores: osm, source: 'osm' };
    }
  } catch (error) {
    console.warn('findNearbyStoresAt OSM failed', error);
    const cached = await loadCachedNearbyStores(lat, lng);
    if (cached?.length) return { stores: cached, source: 'cache' };
  }
  return { stores: [], source: 'none' };
}

/**
 * Nearby grocery + clothing/retail via OSM Overpass. Cached after the first hit
 * so Places / New trip don't wait on Overpass every open.
 */
export async function findNearbyStores(
  origin?: {
    lat: number;
    lng: number;
  } | null,
  options?: { forceRefresh?: boolean }
): Promise<{
  stores: PreferredStore[];
  coords: { lat: number; lng: number } | null;
  source: 'osm' | 'cache' | 'none' | 'denied';
}> {
  const coords = origin ?? (await getCurrentCoords());
  if (!coords) {
    return { stores: [], coords: null, source: 'denied' };
  }

  const { stores, source } = await findNearbyStoresAt(coords.lat, coords.lng, options);
  return { stores, coords, source };
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
