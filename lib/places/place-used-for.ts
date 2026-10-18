/**
 * Place row “used for” subtitle — WO14 §4.
 */
import type { HouseholdSnapshot, SavedPlace } from '@/types/orbit';

function namesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** How many trips reference this place (savedPlaceId or name/address match). */
export function tripUseCount(place: SavedPlace, household: HouseholdSnapshot): number {
  let count = 0;
  for (const trip of household.itineraries ?? []) {
    const hit = (trip.stops ?? []).some(
      (stop) =>
        stop.savedPlaceId === place.id ||
        namesMatch(stop.label, place.name) ||
        (stop.address && place.address && namesMatch(stop.address, place.address))
    );
    if (hit) count += 1;
  }
  return count;
}

/**
 * One-line “what this place is used for” for Places rows.
 * Prefer trip / pickup / default-shop context over repeating the address.
 */
export function placeUsedForSubtitle(
  place: SavedPlace,
  household: HouseholdSnapshot
): { text: string; needsAddress: boolean } {
  const needsAddress = !place.address?.trim();
  if (needsAddress) {
    return { text: 'No address yet', needsAddress: true };
  }

  const trips = tripUseCount(place, household);
  if (trips > 0) {
    return { text: `Used in ${trips} trip${trips === 1 ? '' : 's'}`, needsAddress: false };
  }

  if (place.kind === 'school' || place.kind === 'pickup' || place.kind === 'practice') {
    const items = place.pickupItemNames ?? [];
    if (items.length > 0) {
      return { text: items.slice(0, 2).join(' · '), needsAddress: false };
    }
  }

  if (place.kind === 'shop' || place.kind === 'clothing') {
    const preferred = household.preferredStoreId;
    if (preferred && (place.id === preferred || place.name)) {
      // Prefer marking the household preferred store when ids align.
      if (place.id === preferred) {
        return { text: 'Default shop', needsAddress: false };
      }
    }
    if (place.isFavorite) {
      return { text: 'Default shop', needsAddress: false };
    }
  }

  if (place.pickupItemNames && place.pickupItemNames.length > 0) {
    return {
      text: `Pickup · ${place.pickupItemNames.length} item${place.pickupItemNames.length === 1 ? '' : 's'}`,
      needsAddress: false,
    };
  }

  return { text: place.address, needsAddress: false };
}
