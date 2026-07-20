import { Linking, Platform } from 'react-native';

export type MapDestination = {
  address?: string;
  placeQuery?: string;
};

function destinationQuery(dest: MapDestination): string {
  return (dest.address || dest.placeQuery || '').trim();
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

/**
 * Progressive stop-by-stop handoff (Spotify→Waze style).
 * Opens Apple Maps on iOS, Google Maps elsewhere — one leg at a time.
 */
export async function openDirections(from: MapDestination | undefined, to: MapDestination): Promise<boolean> {
  const query = destinationQuery(to);
  if (!query) {
    return false;
  }

  const url = Platform.OS === 'ios' ? buildAppleMapsUrl(from, to) : buildGoogleMapsUrl(from, to);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    const fallback = buildGoogleMapsUrl(from, to);
    await Linking.openURL(fallback);
    return true;
  }
  await Linking.openURL(url);
  return true;
}
