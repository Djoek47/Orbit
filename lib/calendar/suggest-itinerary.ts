/**
 * Build a Poppins trip from calendar events + saved Places only.
 * Never invents FreshMart / “1200 Market Street” catalog stops.
 */
import { suggestItinerarySummary } from '@/lib/calendar/event-groups';
import { haversineMeters } from '@/lib/places/geo-distance';

/** Catalog mock shops — never use these as trip stop addresses. */
const FAKE_STORE_RE = /freshmart|quickstop|orbit wholesale|bytebarn/i;
function isFakeStoreName(name?: string | null): boolean {
  return Boolean(name && FAKE_STORE_RE.test(name.trim()));
}

function shopNearStops(
  shop: { lat?: number; lng?: number },
  stops: { lat?: number; lng?: number }[],
  maxMeters: number
): boolean {
  if (typeof shop.lat !== 'number' || typeof shop.lng !== 'number') return false;
  return stops.some(
    (stop) =>
      typeof stop.lat === 'number' &&
      typeof stop.lng === 'number' &&
      haversineMeters(shop.lat!, shop.lng!, stop.lat, stop.lng) <= maxMeters
  );
}
import type {
  CreateItineraryInput,
  GroceryItem,
  HouseholdEvent,
  HouseholdSnapshot,
  ItineraryStopKind,
  SavedPlace,
} from '@/types/orbit';

export type SuggestItineraryMode = 'efficient' | 'spread';

export type SuggestItineraryOptions = {
  date?: string;
  mode?: SuggestItineraryMode;
  eventIds?: string[];
};

type DraftStop = CreateItineraryInput['stops'][number];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function eventsForDate(household: HouseholdSnapshot, dateKey: string, eventIds?: string[]) {
  const events = household.events.filter((event) => {
    if (eventIds?.length) {
      return eventIds.includes(event.id);
    }
    if (event.startsAt?.startsWith(dateKey)) return true;
    if (dateKey === todayKey() && /today/i.test(event.date)) return true;
    if (/tomorrow/i.test(event.date)) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().slice(0, 10) === dateKey;
    }
    return false;
  });
  return events.sort((a, b) => (a.startsAt ?? a.time).localeCompare(b.startsAt ?? b.time));
}

function kindForEvent(event: HouseholdEvent): ItineraryStopKind {
  if (event.category === 'School') return 'school';
  if (event.category === 'Activity') return 'practice';
  if (event.category === 'Appointment') return 'pickup';
  return 'custom';
}

function placeKindForEvent(event: HouseholdEvent): SavedPlace['kind'] | null {
  if (event.category === 'School') return 'school';
  if (event.category === 'Activity') return 'practice';
  if (event.category === 'Appointment') return 'pickup';
  return null;
}

function isHardStop(kind: ItineraryStopKind) {
  return kind === 'school' || kind === 'practice' || kind === 'pickup' || kind === 'work' || kind === 'family';
}

function reindex(stops: DraftStop[]): DraftStop[] {
  return stops.map((stop, index) => ({ ...stop, sortOrder: index }));
}

function shortSummary(stops: DraftStop[]): string {
  const labels = stops.slice(0, 3).map((s) => s.label.split(' ')[0] ?? s.label);
  const trail = stops.length > 3 ? ` · +${stops.length - 3}` : '';
  return labels.join(' → ') + trail;
}

function looksLikeRealAddress(value?: string | null): boolean {
  const text = value?.trim() ?? '';
  if (text.length < 5) return false;
  if (isFakeStoreName(text)) return false;
  // Reject bare shop names with no street-ish signal when we have no coords.
  if (!/\d/.test(text) && !/,/.test(text) && text.split(/\s+/).length < 3) return false;
  return true;
}

/** Match a saved place to an event (kind, then name/address overlap). */
export function matchSavedPlaceForEvent(
  event: HouseholdEvent,
  places: SavedPlace[]
): SavedPlace | null {
  const kind = placeKindForEvent(event);
  if (kind) {
    const byKind = places.find((p) => p.kind === kind && !isFakeStoreName(p.name));
    if (byKind) return byKind;
  }
  const loc = event.location?.trim().toLowerCase() ?? '';
  const title = event.title.trim().toLowerCase();
  if (loc) {
    const byAddress = places.find(
      (p) =>
        !isFakeStoreName(p.name) &&
        (p.address?.toLowerCase().includes(loc) ||
          loc.includes(p.address?.toLowerCase() ?? '') ||
          p.name.toLowerCase() === loc)
    );
    if (byAddress) return byAddress;
  }
  if (title) {
    const byName = places.find(
      (p) => !isFakeStoreName(p.name) && title.includes(p.name.toLowerCase())
    );
    if (byName) return byName;
  }
  return null;
}

type ResolvedStop = {
  label: string;
  kind: ItineraryStopKind;
  address?: string;
  placeQuery?: string;
  lat?: number;
  lng?: number;
  savedPlaceId?: string;
  eventId?: string;
  etaMinutes: number;
};

/** Resolve an event to a stop with a real Places address (or a solid event location). */
export function resolveEventStop(
  event: HouseholdEvent,
  places: SavedPlace[]
): ResolvedStop | null {
  const kind = kindForEvent(event);
  const matched = matchSavedPlaceForEvent(event, places);
  if (matched && looksLikeRealAddress(matched.address)) {
    return {
      label: event.title || matched.name,
      kind,
      address: matched.address,
      placeQuery: matched.placeQuery ?? matched.address,
      lat: matched.lat,
      lng: matched.lng,
      savedPlaceId: matched.id,
      eventId: event.id,
      etaMinutes: 15,
    };
  }
  if (looksLikeRealAddress(event.location)) {
    return {
      label: event.title,
      kind,
      address: event.location!.trim(),
      placeQuery: event.location!.trim(),
      eventId: event.id,
      etaMinutes: 15,
    };
  }
  // Event with a matched place that has coords even if address text is thin.
  if (matched && typeof matched.lat === 'number' && typeof matched.lng === 'number') {
    return {
      label: event.title || matched.name,
      kind,
      address: matched.address,
      placeQuery: matched.placeQuery ?? matched.address ?? matched.name,
      lat: matched.lat,
      lng: matched.lng,
      savedPlaceId: matched.id,
      eventId: event.id,
      etaMinutes: 15,
    };
  }
  return null;
}

/** Saved shop only — never curated FreshMart / QuickStop fallbacks. */
export function resolveGroceryStop(
  places: SavedPlace[],
  existingStops: DraftStop[],
  missingCount: number
): DraftStop | null {
  if (missingCount <= 0) return null;
  const shops = places.filter(
    (p) => (p.kind === 'shop' || p.kind === 'pickup') && !isFakeStoreName(p.name)
  );
  if (shops.length === 0) return null;
  const onTheWay = shops.find((shop) => shopNearStops(shop, existingStops, 2000)) ?? null;
  const shop = onTheWay ?? shops[0]!;
  if (!looksLikeRealAddress(shop.address) && !(typeof shop.lat === 'number' && typeof shop.lng === 'number')) {
    return null;
  }
  return {
    label: onTheWay ? `${shop.name} (on the way)` : `${shop.name} groceries`,
    kind: 'grocery',
    address: shop.address,
    placeQuery: shop.placeQuery ?? shop.address,
    lat: shop.lat,
    lng: shop.lng,
    savedPlaceId: shop.id,
    groceryListId: 'cart-today',
    etaMinutes: Math.min(35, 10 + missingCount * 3),
    sortOrder: existingStops.length,
  };
}

/**
 * Efficient: calendar stops in time order; grocery only from saved Places if on the way / end.
 * Never invents catalog store addresses.
 */
export function suggestItineraryFromHousehold(
  household: HouseholdSnapshot,
  options: SuggestItineraryOptions = {}
): CreateItineraryInput {
  const dateKey = options.date ?? todayKey();
  const mode: SuggestItineraryMode = options.mode ?? 'efficient';
  const dayEvents = eventsForDate(household, dateKey, options.eventIds);
  const missing = household.groceries.filter((item) => item.status === 'Missing' || item.status === 'Low');
  const places = (household.savedPlaces ?? []).filter((p) => !isFakeStoreName(p.name));

  const stops: DraftStop[] = [];
  const usedEventIds = new Set<string>();

  for (const event of dayEvents) {
    if (usedEventIds.has(event.id)) continue;
    const resolved = resolveEventStop(event, places);
    if (!resolved) continue;
    usedEventIds.add(event.id);
    stops.push({
      ...resolved,
      sortOrder: stops.length,
    });
  }

  const hardCount = stops.filter((s) => isHardStop(s.kind)).length;
  const deferGrocery = mode === 'spread' && hardCount >= 3 && missing.length > 0;

  if (missing.length > 0 && !deferGrocery) {
    const grocery = resolveGroceryStop(places, stops, missing.length);
    if (grocery) stops.push(grocery);
  }

  const home = places.find((p) => p.kind === 'home' && looksLikeRealAddress(p.address));
  if (mode === 'efficient' && home && stops.length > 0 && !stops.some((s) => s.kind === 'home')) {
    stops.push({
      label: home.name,
      kind: 'home',
      address: home.address,
      placeQuery: home.placeQuery ?? home.address,
      lat: home.lat,
      lng: home.lng,
      savedPlaceId: home.id,
      etaMinutes: 8,
      sortOrder: stops.length,
    });
  }

  const ordered = reindex(stops);
  const etaMinutes = ordered.reduce((sum, stop) => sum + (stop.etaMinutes ?? 10), 0);
  const schoolEvent = dayEvents.find((e) => e.category === 'School');
  const leaveBy = schoolEvent?.time ? bumpLeaveBy(schoolEvent.time, 10) : undefined;
  const modeNote =
    mode === 'spread' && deferGrocery
      ? ' · groceries deferred'
      : mode === 'efficient'
        ? ' · from your calendar'
        : ' · lighter day';

  const baseSummary =
    ordered.length > 0
      ? shortSummary(ordered) + modeNote + (leaveBy ? ` · leave by ${leaveBy}` : '')
      : 'No stops with real places yet';

  return {
    title: mode === 'spread' ? 'Poppins light run' : 'Poppins suggested run',
    date: dateKey,
    suggestedByPoppins: true,
    summary:
      ordered.length > 0
        ? baseSummary
        : suggestItinerarySummary({ stopCount: 0, etaMinutes: 0, leaveBy: leaveBy ?? 'soon' }),
    stops: ordered,
  };
}

/** True when Build trip can produce at least one real stop for these events. */
export function canSuggestTripFromEvents(
  household: HouseholdSnapshot,
  events: HouseholdEvent[]
): boolean {
  if (events.length === 0) return false;
  const places = (household.savedPlaces ?? []).filter((p) => !isFakeStoreName(p.name));
  const resolved = events.filter((event) => resolveEventStop(event, places) != null).length;
  if (resolved >= 2) return true;
  if (resolved >= 1) {
    const missing = household.groceries.some((g) => g.status === 'Missing' || g.status === 'Low');
    const hasShop = places.some(
      (p) =>
        (p.kind === 'shop' || p.kind === 'pickup') &&
        (looksLikeRealAddress(p.address) || (typeof p.lat === 'number' && typeof p.lng === 'number'))
    );
    return missing && hasShop;
  }
  return false;
}

/** Reorder / trim a manual draft: time-critical kinds first, grocery last (or drop in spread). */
export function optimizeDraftStops(
  stops: DraftStop[],
  mode: SuggestItineraryMode = 'efficient'
): DraftStop[] {
  if (stops.length <= 1) return reindex(stops);

  const hard = stops.filter((s) => isHardStop(s.kind));
  const soft = stops.filter(
    (s) => !isHardStop(s.kind) && s.kind !== 'home' && s.kind !== 'grocery' && s.kind !== 'shop'
  );
  const grocery = stops.filter((s) => s.kind === 'grocery' || s.kind === 'shop');
  const home = stops.filter((s) => s.kind === 'home');

  if (mode === 'spread' && hard.length >= 3) {
    return reindex([...hard, ...soft.slice(0, 1), ...home.slice(0, 1)]);
  }

  return reindex([...hard, ...soft, ...grocery, ...home]);
}

function bumpLeaveBy(timeLabel: string, minutesBefore: number) {
  const match = timeLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) {
    return timeLabel;
  }
  let hours = Number(match[1]);
  let minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  const total = hours * 60 + minutes - minutesBefore;
  const h24 = Math.floor((((total % 1440) + 1440) % 1440) / 60);
  const m = ((total % 60) + 60) % 60;
  const h12 = h24 % 12 || 12;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function estimateCartMinutes(groceries: GroceryItem[]) {
  const count = groceries.filter((item) => item.status === 'Missing' || item.status === 'Low').length;
  return Math.min(40, 8 + count * 3);
}
