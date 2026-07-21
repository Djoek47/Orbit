import { getPreferredStore } from '@/data/preferred-stores';
import { suggestItinerarySummary } from '@/lib/calendar/event-groups';
import { shopNearStops } from '@/lib/places/nearby-stores';
import type { CreateItineraryInput, GroceryItem, HouseholdEvent, HouseholdSnapshot } from '@/types/orbit';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Build a school → activity → grocery run from today's events + missing list. */
export function suggestItineraryFromHousehold(household: HouseholdSnapshot): CreateItineraryInput {
  const todayEvents = household.events
    .filter((event) => /today/i.test(event.date) || event.startsAt?.startsWith(todayKey()))
    .sort((a, b) => (a.startsAt ?? a.time).localeCompare(b.startsAt ?? b.time));

  const store = getPreferredStore(household.preferredStoreId);
  const missing = household.groceries.filter((item) => item.status === 'Missing' || item.status === 'Low');
  const places = household.savedPlaces ?? [];

  const stops: CreateItineraryInput['stops'] = [];
  let order = 0;

  const schoolPlace = places.find((p) => p.kind === 'school');
  const practicePlace = places.find((p) => p.kind === 'practice');
  const school = todayEvents.find((event) => event.category === 'School');
  const activity = todayEvents.find((event) => event.category === 'Activity' || event.category === 'Appointment');

  const pushEventStop = (event: HouseholdEvent, kind: 'school' | 'pickup' | 'custom') => {
    stops.push({
      label: event.title,
      kind,
      address: event.location,
      placeQuery: event.location,
      eventId: event.id,
      etaMinutes: 15,
      sortOrder: order,
    });
    order += 1;
  };

  if (schoolPlace) {
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
      sortOrder: order,
    });
    order += 1;
  } else if (school) {
    pushEventStop(school, 'school');
  }

  if (practicePlace) {
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
      sortOrder: order,
    });
    order += 1;
  } else if (activity) {
    pushEventStop(activity, 'pickup');
  }

  for (const event of todayEvents) {
    if (event.id === school?.id || event.id === activity?.id) {
      continue;
    }
    pushEventStop(event, 'custom');
  }

  if (missing.length > 0) {
    const shopPlace = places.find((p) => p.kind === 'shop');
    const insertNear =
      shopPlace &&
      shopNearStops(shopPlace, stops, 2000)
        ? shopPlace
        : null;
    const groceryTarget = insertNear
      ? {
          label: `${insertNear.name} (on the way)`,
          address: insertNear.address,
          placeQuery: insertNear.placeQuery ?? insertNear.address,
          lat: insertNear.lat,
          lng: insertNear.lng,
          savedPlaceId: insertNear.id,
        }
      : {
          label: `${store.name} groceries`,
          address: store.address,
          placeQuery: store.placeQuery,
          lat: store.lat,
          lng: store.lng,
          savedPlaceId: undefined,
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
      sortOrder: order,
    });
  }

  if (stops.length === 0) {
    const home = places.find((p) => p.kind === 'home');
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

  const etaMinutes = stops.reduce((sum, stop) => sum + (stop.etaMinutes ?? 10), 0);
  const leaveBy = school?.time ? bumpLeaveBy(school.time, 10) : '3:10';

  return {
    title: 'Nova suggested run',
    date: todayKey(),
    suggestedByNova: true,
    summary: suggestItinerarySummary({ stopCount: stops.length, etaMinutes, leaveBy }),
    stops,
  };
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
  const h24 = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  const h12 = h24 % 12 || 12;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function estimateCartMinutes(groceries: GroceryItem[]) {
  const count = groceries.filter((item) => item.status === 'Missing' || item.status === 'Low').length;
  return Math.min(40, 8 + count * 3);
}
