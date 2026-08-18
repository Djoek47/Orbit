import { getPreferredStore } from '@/data/preferred-stores';
import { suggestItinerarySummary } from '@/lib/calendar/event-groups';
import { shopNearStops } from '@/lib/places/nearby-stores';
import type {
  CreateItineraryInput,
  GroceryItem,
  HouseholdEvent,
  HouseholdSnapshot,
  ItineraryStopKind,
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
    // Loose mock labels: "Tomorrow" only when dateKey is tomorrow
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

/**
 * Efficient: one time-ordered loop; grocery only if on the way or at end.
 * Spread: keep hard pickups; defer grocery/errands when the day is dense (3+ hard stops).
 */
export function suggestItineraryFromHousehold(
  household: HouseholdSnapshot,
  options: SuggestItineraryOptions = {}
): CreateItineraryInput {
  const dateKey = options.date ?? todayKey();
  const mode: SuggestItineraryMode = options.mode ?? 'efficient';
  const dayEvents = eventsForDate(household, dateKey, options.eventIds);
  const store = getPreferredStore(household.preferredStoreId);
  const missing = household.groceries.filter((item) => item.status === 'Missing' || item.status === 'Low');
  const places = household.savedPlaces ?? [];

  const stops: DraftStop[] = [];
  const usedEventIds = new Set<string>();

  const schoolPlace = places.find((p) => p.kind === 'school');
  const practicePlace = places.find((p) => p.kind === 'practice');
  const school = dayEvents.find((event) => event.category === 'School');
  const activity = dayEvents.find(
    (event) => event.category === 'Activity' || event.category === 'Appointment'
  );

  const pushEventStop = (event: HouseholdEvent, kind: ItineraryStopKind) => {
    if (usedEventIds.has(event.id)) return;
    usedEventIds.add(event.id);
    stops.push({
      label: event.title,
      kind,
      address: event.location,
      placeQuery: event.location,
      eventId: event.id,
      etaMinutes: 15,
      sortOrder: stops.length,
    });
  };

  if (schoolPlace && (school || !options.eventIds?.length)) {
    stops.push({
      label: schoolPlace.name,
      kind: 'school',
      address: schoolPlace.address,
      placeQuery: schoolPlace.placeQuery ?? schoolPlace.address,
      lat: schoolPlace.lat,
      lng: schoolPlace.lng,
      savedPlaceId: schoolPlace.id,
      eventId: school?.id,
      etaMinutes: 12,
      sortOrder: stops.length,
    });
    if (school) usedEventIds.add(school.id);
  } else if (school) {
    pushEventStop(school, 'school');
  }

  if (practicePlace && (activity || !options.eventIds?.length)) {
    stops.push({
      label: practicePlace.name,
      kind: 'practice',
      address: practicePlace.address,
      placeQuery: practicePlace.placeQuery ?? practicePlace.address,
      lat: practicePlace.lat,
      lng: practicePlace.lng,
      savedPlaceId: practicePlace.id,
      eventId: activity?.id,
      etaMinutes: 18,
      sortOrder: stops.length,
    });
    if (activity) usedEventIds.add(activity.id);
  } else if (activity) {
    pushEventStop(activity, kindForEvent(activity));
  }

  for (const event of dayEvents) {
    if (usedEventIds.has(event.id)) continue;
    pushEventStop(event, kindForEvent(event));
  }

  const hardCount = stops.filter((s) => isHardStop(s.kind)).length;
  const deferGrocery = mode === 'spread' && hardCount >= 3 && missing.length > 0;

  if (missing.length > 0 && !deferGrocery) {
    const shopPlace = places.find((p) => p.kind === 'shop');
    const onTheWay =
      shopPlace && shopNearStops(shopPlace, stops, 2000) ? shopPlace : null;
    const groceryTarget = onTheWay
      ? {
          label: `${onTheWay.name} (on the way)`,
          address: onTheWay.address,
          placeQuery: onTheWay.placeQuery ?? onTheWay.address,
          lat: onTheWay.lat,
          lng: onTheWay.lng,
          savedPlaceId: onTheWay.id,
        }
      : {
          label: `${store.name} groceries`,
          address: store.address,
          placeQuery: store.placeQuery,
          lat: store.lat,
          lng: store.lng,
          savedPlaceId: undefined as string | undefined,
        };
    stops.push({
      label: groceryTarget.label,
      kind: 'grocery',
      address: groceryTarget.address,
      placeQuery: groceryTarget.placeQuery,
      lat: groceryTarget.lat,
      lng: groceryTarget.lng,
      savedPlaceId: groceryTarget.savedPlaceId,
      groceryListId: 'cart-today',
      etaMinutes: Math.min(35, 10 + missing.length * 3),
      sortOrder: stops.length,
    });
  }

  const home = places.find((p) => p.kind === 'home');
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

  if (stops.length === 0) {
    stops.push({
      label: home?.name ?? 'Home base',
      kind: home ? 'home' : 'custom',
      address: home?.address,
      placeQuery: home?.placeQuery ?? household.householdName,
      lat: home?.lat,
      lng: home?.lng,
      savedPlaceId: home?.id,
      etaMinutes: 5,
      sortOrder: 0,
    });
  }

  const ordered = reindex(stops);
  const etaMinutes = ordered.reduce((sum, stop) => sum + (stop.etaMinutes ?? 10), 0);
  const leaveBy = school?.time ? bumpLeaveBy(school.time, 10) : undefined;
  const modeNote =
    mode === 'spread' && deferGrocery
      ? ' · groceries deferred'
      : mode === 'efficient'
        ? ' · efficient loop'
        : ' · lighter day';

  const baseSummary = shortSummary(ordered) + modeNote + (leaveBy ? ` · leave by ${leaveBy}` : '');

  return {
    title: mode === 'spread' ? 'Poppins light run' : 'Poppins suggested run',
    date: dateKey,
    suggestedByPoppins: true,
    summary:
      baseSummary.trim().length > 0
        ? baseSummary
        : suggestItinerarySummary({ stopCount: ordered.length, etaMinutes, leaveBy: leaveBy ?? 'soon' }),
    stops: ordered,
  };
}

/** Reorder / trim a manual draft: time-critical kinds first, grocery last (or drop in spread). */
export function optimizeDraftStops(
  stops: DraftStop[],
  mode: SuggestItineraryMode = 'efficient'
): DraftStop[] {
  if (stops.length <= 1) return reindex(stops);

  const hard = stops.filter((s) => isHardStop(s.kind));
  const soft = stops.filter((s) => !isHardStop(s.kind) && s.kind !== 'home' && s.kind !== 'grocery' && s.kind !== 'shop');
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
