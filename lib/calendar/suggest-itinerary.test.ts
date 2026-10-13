/**
 * Run: npx tsx lib/calendar/suggest-itinerary.test.ts
 */
import assert from 'node:assert/strict';

import {
  canSuggestTripFromEvents,
  resolveGroceryStop,
  suggestItineraryFromHousehold,
} from '@/lib/calendar/suggest-itinerary';
import type { HouseholdEvent, HouseholdSnapshot, SavedPlace } from '@/types/orbit';

const home: SavedPlace = {
  id: 'place-home',
  name: 'Home',
  kind: 'home',
  address: '1440 Boul Henri-Bourassa E, Montréal',
  placeQuery: '1440 Boul Henri-Bourassa E',
  lat: 45.58,
  lng: -73.64,
};

const shop: SavedPlace = {
  id: 'place-iga',
  name: 'IGA',
  kind: 'shop',
  address: '7500 Rue Sherbrooke E, Montréal',
  placeQuery: 'IGA Sherbrooke',
  lat: 45.59,
  lng: -73.55,
};

const schoolEvent: HouseholdEvent = {
  id: 'ev-school',
  title: 'School pickup',
  category: 'School',
  date: 'Today',
  time: '3:15 PM',
  location: '',
  responsible: 'Nero',
  startsAt: `${new Date().toISOString().slice(0, 10)}T15:15:00.000Z`,
};

const activityEvent: HouseholdEvent = {
  id: 'ev-soccer',
  title: 'Soccer',
  category: 'Activity',
  date: 'Today',
  time: '5:00 PM',
  location: 'Parc Maisonneuve, Montréal',
  responsible: 'Nero',
  startsAt: `${new Date().toISOString().slice(0, 10)}T17:00:00.000Z`,
};

function snap(partial: Partial<HouseholdSnapshot>): HouseholdSnapshot {
  return {
    id: 'hh',
    householdName: 'Test',
    members: [],
    tasks: [],
    groceries: [{ id: 'g1', name: 'Milk', category: 'Dairy', quantity: '1', status: 'Missing' }],
    events: [schoolEvent, activityEvent],
    itineraries: [],
    rewards: [],
    notifications: [],
    taskTemplates: [],
    notificationPrefs: {
      tasks: true,
      itinerary: true,
      groceries: true,
      rewards: true,
      deals: true,
      plans: true,
      xpFairness: true,
      nearShop: true,
      missingOnTheWay: true,
    },
    savedPlaces: [home, shop],
    ...partial,
  } as HouseholdSnapshot;
}

const household = snap({});
const draft = suggestItineraryFromHousehold(household, {
  date: new Date().toISOString().slice(0, 10),
  eventIds: [schoolEvent.id, activityEvent.id],
});

assert.ok(draft.stops.length >= 2, 'builds from calendar events');
assert.ok(
  !draft.stops.some((s) => /1200 Market|FreshMart/i.test(`${s.label} ${s.address ?? ''}`)),
  'never uses FreshMart fake address'
);
assert.ok(
  draft.stops.some((s) => s.kind === 'grocery' && s.address?.includes('Sherbrooke')),
  'grocery uses saved shop place'
);
assert.ok(
  draft.stops.some((s) => s.kind === 'home' && s.address?.includes('Henri-Bourassa')),
  'home from Places'
);

const noPlaces = snap({ savedPlaces: [], groceries: [] });
const empty = suggestItineraryFromHousehold(noPlaces, {
  date: new Date().toISOString().slice(0, 10),
  eventIds: [schoolEvent.id],
});
assert.equal(empty.stops.length, 0, 'no fake fallback when Places missing');

assert.equal(
  canSuggestTripFromEvents(household, [activityEvent]),
  true,
  'one event + missing + shop → can build'
);
assert.equal(
  canSuggestTripFromEvents(snap({ groceries: [], savedPlaces: [home] }), [schoolEvent]),
  false,
  'school with no address/place and no shop → hide Build trip'
);

assert.equal(
  resolveGroceryStop([], [], 3),
  null,
  'no grocery stop without a saved shop'
);

console.log('suggest-itinerary: ok');
