/**
 * Trip detail thinks in one current stop — never three copies of Metro.
 * Run: npx --yes tsx --test lib/itinerary/trip-intent.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type { Itinerary, ItineraryStop } from '../../types/orbit';
import {
  applyStopOrder,
  formatStopCount,
  looksLikeCoordinates,
  makeStopNextIds,
  moveOpenStopIds,
  stopPlaceLine,
  tripIntent,
  tripWhenLabel,
} from './trip-intent';

function stop(
  partial: Partial<ItineraryStop> & Pick<ItineraryStop, 'id' | 'label'>,
): ItineraryStop {
  return {
    kind: 'grocery',
    sortOrder: 0,
    status: 'active',
    address: '123 Market St',
    etaMinutes: 12,
    ...partial,
  };
}

function trip(
  partial: Partial<Itinerary> & Pick<Itinerary, 'id' | 'title' | 'stops' | 'status'>,
): Itinerary {
  return {
    householdId: 'hh-test',
    date: '2026-08-25',
    ...partial,
  };
}

test('looksLikeCoordinates rejects addresses and catches lat/lng', () => {
  assert.equal(looksLikeCoordinates('123 Market St'), false);
  assert.equal(looksLikeCoordinates('Metro'), false);
  assert.equal(looksLikeCoordinates('45.5740, -73.6850'), true);
  assert.equal(looksLikeCoordinates('45.574,-73.685'), true);
});

test('stopPlaceLine never shows coordinates or repeats the name', () => {
  assert.equal(
    stopPlaceLine(stop({ id: 'a', label: 'Metro', address: '45.5740, -73.6850' })),
    null,
  );
  assert.equal(
    stopPlaceLine(stop({ id: 'a', label: 'Metro', address: 'Metro', placeQuery: 'Metro' })),
    null,
  );
  assert.equal(
    stopPlaceLine(
      stop({ id: 'a', label: 'Metro', address: '9200 Boul. Lacordaire' }),
    ),
    '9200 Boul. Lacordaire',
  );
});

test('formatStopCount does not say 1 stops', () => {
  assert.equal(formatStopCount(1), '1 stop');
  assert.equal(formatStopCount(3), '3 stops');
});

test('tripWhenLabel is relative to local ISO, not UTC slice', () => {
  assert.equal(tripWhenLabel('2026-08-25', '2026-08-25'), 'Today');
  assert.equal(tripWhenLabel('2026-08-26', '2026-08-25'), 'Tomorrow');
  assert.equal(tripWhenLabel('2026-08-24', '2026-08-25'), 'Yesterday');
  assert.equal(tripWhenLabel('2026-08-20', '2026-08-25'), 'Thu, Aug 20');
});

test('one grocery stop: hero only, Directions, finish, shopping, no lists', () => {
  const intent = tripIntent(
    trip({
      id: 'g',
      title: 'Plan a grocery run.',
      status: 'active',
      stops: [stop({ id: 'metro', label: 'Metro' })],
    }),
    '2026-08-25',
  );
  assert.equal(intent.phase, 'active');
  assert.equal(intent.current?.label, 'Metro');
  assert.equal(intent.subtitle, 'Today');
  assert.equal(intent.showComingUp, false);
  assert.equal(intent.showReorder, false);
  assert.equal(intent.showCompletedRecap, false);
  assert.equal(intent.showShopping, true);
  assert.equal(intent.showDirections, true);
  assert.equal(intent.showImHere, true);
  assert.equal(intent.primaryCta, 'directions');
  assert.equal(intent.primaryCtaLabel, 'Directions');
  assert.equal(intent.imHereLabel, 'I’m here — finish');
});

test('two remaining stops: coming up + reorder, I’m here does not say finish', () => {
  const intent = tripIntent(
    trip({
      id: 'errands',
      title: 'Errands',
      status: 'draft',
      stops: [
        stop({ id: 'a', label: 'Metro', sortOrder: 0, status: 'active' }),
        stop({
          id: 'b',
          label: 'Pharmacy',
          kind: 'custom',
          sortOrder: 1,
          status: 'pending',
        }),
      ],
    }),
    '2026-08-25',
  );
  assert.equal(intent.phase, 'planned');
  assert.equal(intent.upcoming.length, 1);
  assert.equal(intent.showComingUp, true);
  assert.equal(intent.showReorder, true);
  assert.equal(intent.showShopping, true);
  assert.equal(intent.imHereLabel, 'I’m here');
});

test('completed trip offers run again, not directions', () => {
  const intent = tripIntent(
    trip({
      id: 'done',
      title: 'Grocery',
      status: 'completed',
      stops: [stop({ id: 'metro', label: 'Metro', status: 'done' })],
    }),
    '2026-08-25',
  );
  assert.equal(intent.phase, 'completed');
  assert.equal(intent.showRunAgain, true);
  assert.equal(intent.showDirections, false);
  assert.equal(intent.primaryCta, 'run_again');
  assert.equal(intent.subtitle, 'Today · Done');
});

test('empty itinerary is calm and has no CTAs', () => {
  const intent = tripIntent(
    trip({
      id: 'empty',
      title: 'Trip',
      status: 'draft',
      stops: [],
    }),
    '2026-08-25',
  );
  assert.equal(intent.phase, 'empty');
  assert.equal(intent.primaryCta, 'none');
  assert.equal(intent.emptyTitle, 'No stops yet');
});

test('applyStopOrder promotes the first open stop to active', () => {
  const stops = applyStopOrder(
    [
      stop({ id: 'a', label: 'A', status: 'active', sortOrder: 0 }),
      stop({ id: 'b', label: 'B', status: 'pending', sortOrder: 1, kind: 'custom' }),
    ],
    ['b', 'a'],
  );
  assert.equal(stops[0]?.id, 'b');
  assert.equal(stops[0]?.status, 'active');
  assert.equal(stops[1]?.id, 'a');
  assert.equal(stops[1]?.status, 'pending');
});

test('makeStopNextIds keeps completed first and promotes the chosen stop', () => {
  const itinerary = trip({
    id: 'loop',
    title: 'Loop',
    status: 'active',
    stops: [
      stop({ id: 'done', label: 'Done', status: 'done', sortOrder: 0 }),
      stop({ id: 'a', label: 'A', status: 'active', sortOrder: 1 }),
      stop({ id: 'b', label: 'B', status: 'pending', sortOrder: 2, kind: 'custom' }),
    ],
  });
  assert.deepEqual(makeStopNextIds(itinerary, 'b'), ['done', 'b', 'a']);
});

test('moveOpenStopIds only permutes remaining stops', () => {
  const itinerary = trip({
    id: 'loop',
    title: 'Loop',
    status: 'active',
    stops: [
      stop({ id: 'a', label: 'A', status: 'active', sortOrder: 0 }),
      stop({ id: 'b', label: 'B', status: 'pending', sortOrder: 1, kind: 'custom' }),
    ],
  });
  assert.deepEqual(moveOpenStopIds(itinerary, 'b', -1), ['b', 'a']);
  assert.equal(moveOpenStopIds(itinerary, 'a', -1), null);
});
