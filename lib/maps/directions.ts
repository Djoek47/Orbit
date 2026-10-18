import { Linking, Platform } from 'react-native';

import type { PreferredMapsApp } from '@/lib/theme/appearance-prefs';

export type MapDestination = {
  address?: string;
  placeQuery?: string;
  lat?: number;
  lng?: number;
};

function destinationQuery(dest: MapDestination): string {
  if (dest.lat != null && dest.lng != null) {
    return `${dest.lat},${dest.lng}`;
  }
  return (dest.address || dest.placeQuery || '').trim();
}

function destinationLabel(dest: MapDestination): string {
  return (dest.placeQuery || dest.address || destinationQuery(dest)).trim();
}

/** Apple Maps directions URL (iOS-first; also opens in browser elsewhere). */
export function buildAppleMapsUrl(from: MapDestination | undefined, to: MapDestination): string {
  const daddr = encodeURIComponent(destinationQuery(to));
  const saddr = from ? encodeURIComponent(destinationQuery(from)) : '';
  if (saddr) {
    return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddr}&dirflg=d`;
  }
  return `https://maps.apple.com/?daddr=${daddr}&dirflg=d`;
}

/** Google Maps directions URL. */
export function buildGoogleMapsUrl(from: MapDestination | undefined, to: MapDestination): string {
  const destination = encodeURIComponent(destinationQuery(to));
  const origin = from ? encodeURIComponent(destinationQuery(from)) : '';
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export function buildWazeUrl(to: MapDestination): string {
  if (to.lat != null && to.lng != null) {
    return `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`;
  }
  const q = encodeURIComponent(destinationLabel(to));
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}

/** Google multi-stop: origin + destination + waypoints. */
export function buildGoogleMultiStopUrl(stops: MapDestination[]): string | null {
  if (stops.length < 1) return null;
  if (stops.length === 1) return buildGoogleMapsUrl(undefined, stops[0]!);
  const origin = encodeURIComponent(destinationQuery(stops[0]!));
  const destination = encodeURIComponent(destinationQuery(stops[stops.length - 1]!));
  const middle = stops.slice(1, -1).map((s) => encodeURIComponent(destinationQuery(s)));
  const waypoints = middle.length ? `&waypoints=${middle.join('%7C')}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=driving`;
}

/** Apple Maps: chain daddr when possible; otherwise first→last with note. */
export function buildAppleMultiStopUrl(stops: MapDestination[]): string | null {
  if (stops.length < 1) return null;
  if (stops.length === 1) return buildAppleMapsUrl(undefined, stops[0]!);
  if (stops.length === 2) return buildAppleMapsUrl(stops[0], stops[1]!);
  // Apple URL scheme supports multiple daddr via +to: in some clients; use first→rest sequential fallback via first leg.
  const daddrs = stops
    .slice(1)
    .map((s) => encodeURIComponent(destinationQuery(s)))
    .join('+to:');
  const saddr = encodeURIComponent(destinationQuery(stops[0]!));
  return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddrs}&dirflg=d`;
}

export async function resolveMapsApp(preferred: PreferredMapsApp): Promise<'apple' | 'google' | 'waze'> {
  if (preferred === 'apple') return 'apple';
  if (preferred === 'google') return 'google';
  if (preferred === 'waze') {
    const can = await Linking.canOpenURL('waze://');
    return can ? 'waze' : Platform.OS === 'ios' ? 'apple' : 'google';
  }
  // auto
  if (Platform.OS === 'ios') return 'apple';
  return 'google';
}

/**
 * Progressive stop-by-stop handoff.
 * Respects preferred maps app (Auto / Apple / Google / Waze).
 */
export async function openDirections(
  from: MapDestination | undefined,
  to: MapDestination,
  preferred: PreferredMapsApp = 'auto'
): Promise<boolean> {
  const query = destinationQuery(to);
  if (!query && !(to.lat != null && to.lng != null)) {
    return false;
  }

  const app = await resolveMapsApp(preferred);
  let url: string;
  if (app === 'waze') {
    url = buildWazeUrl(to);
  } else if (app === 'apple') {
    url = buildAppleMapsUrl(from, to);
  } else {
    url = buildGoogleMapsUrl(from, to);
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      await Linking.openURL(buildGoogleMapsUrl(from, to));
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    await Linking.openURL(buildGoogleMapsUrl(from, to));
    return true;
  }
}

/**
 * Open a full multi-stop route when the preferred app supports it.
 * Waze only gets the first destination — caller should keep in-app Next stop.
 */
export async function openMultiStopRoute(
  stops: MapDestination[],
  preferred: PreferredMapsApp = 'auto'
): Promise<{ opened: boolean; app: 'apple' | 'google' | 'waze'; sequentialOnly: boolean }> {
  const valid = stops.filter(
    (s) => Boolean(destinationQuery(s)) || (s.lat != null && s.lng != null)
  );
  if (valid.length === 0) {
    return { opened: false, app: 'google', sequentialOnly: true };
  }

  const app = await resolveMapsApp(preferred);

  if (app === 'waze') {
    await openDirections(undefined, valid[0]!, 'waze');
    return { opened: true, app: 'waze', sequentialOnly: valid.length > 1 };
  }

  if (app === 'apple') {
    const url = buildAppleMultiStopUrl(valid);
    if (url) {
      await Linking.openURL(url);
      return { opened: true, app: 'apple', sequentialOnly: false };
    }
  }

  const gUrl = buildGoogleMultiStopUrl(valid);
  if (gUrl) {
    await Linking.openURL(gUrl);
    return { opened: true, app: 'google', sequentialOnly: false };
  }

  return { opened: false, app, sequentialOnly: true };
}
