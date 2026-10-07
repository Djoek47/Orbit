import type { SavedPlace, SavedPlaceKind } from '@/types/orbit';

const PLACE_KINDS: SavedPlaceKind[] = [
  'home',
  'work',
  'school',
  'shop',
  'practice',
  'family',
  'cafe',
  'pickup',
  'clothing',
  'custom',
];

export type SavedPlaceRow = {
  client_key?: string | null;
  name?: string | null;
  kind?: string | null;
  address?: string | null;
  place_query?: string | null;
  lat?: number | null;
  lng?: number | null;
  emoji?: string | null;
  is_favorite?: boolean | null;
  pickup_item_names?: string[] | null;
  sort_order?: number | null;
};

export function normalizeSavedPlaceKind(value: string | null | undefined): SavedPlaceKind {
  const kind = (value ?? '').trim().toLowerCase();
  return (PLACE_KINDS as string[]).includes(kind) ? (kind as SavedPlaceKind) : 'custom';
}

export function mapSavedPlaceRow(row: SavedPlaceRow, fallbackId: string): SavedPlace {
  const pickup = Array.isArray(row.pickup_item_names)
    ? row.pickup_item_names.map((item) => String(item).trim()).filter(Boolean)
    : [];
  return {
    id: String(row.client_key ?? fallbackId).trim() || fallbackId,
    name: String(row.name ?? '').trim() || 'Place',
    kind: normalizeSavedPlaceKind(row.kind),
    address: String(row.address ?? '').trim(),
    placeQuery: row.place_query?.trim() || String(row.address ?? '').trim() || undefined,
    lat: typeof row.lat === 'number' && Number.isFinite(row.lat) ? row.lat : undefined,
    lng: typeof row.lng === 'number' && Number.isFinite(row.lng) ? row.lng : undefined,
    emoji: row.emoji?.trim() || undefined,
    isFavorite: Boolean(row.is_favorite),
    pickupItemNames: pickup,
  };
}

export function savedPlaceToRow(
  householdId: string,
  place: SavedPlace,
  sortOrder: number
): Record<string, unknown> {
  return {
    household_id: householdId,
    client_key: place.id,
    name: place.name.trim() || 'Place',
    kind: normalizeSavedPlaceKind(place.kind),
    address: place.address.trim(),
    place_query: place.placeQuery?.trim() || place.address.trim() || null,
    lat: typeof place.lat === 'number' && Number.isFinite(place.lat) ? place.lat : null,
    lng: typeof place.lng === 'number' && Number.isFinite(place.lng) ? place.lng : null,
    emoji: place.emoji?.trim() || null,
    is_favorite: Boolean(place.isFavorite),
    pickup_item_names: place.pickupItemNames ?? [],
    sort_order: sortOrder,
  };
}

/** Prefer the persisted list. `null` means nothing stored yet — keep snapshot defaults. */
export function mergeHydratedPlaces(
  stored: SavedPlace[] | null,
  fallback: SavedPlace[] | undefined
): SavedPlace[] {
  if (stored) return stored;
  return fallback ?? [];
}

export function isMissingPlacesTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? '').toUpperCase();
  const message = String(error.message ?? '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === 'PGRST204') return true;
  return (
    message.includes('household_saved_places') &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find'))
  );
}
