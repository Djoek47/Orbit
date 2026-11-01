/**
 * WO10 D4 — multi-stop itinerary intent.
 * Run: npx tsx lib/itinerary/itinerary-intent.test.ts
 */
import assert from 'node:assert/strict';

import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { parseItineraryIntent } from '@/lib/itinerary/itinerary-intent';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';

const sixStop =
  "create me an itinerary: kids' practice, then work, then shopping on my break, back to work, gym, pick up the kids";

const six = parseItineraryIntent(sixStop);
assert.ok(six, 'six-stop itinerary parses');
assert.equal(six!.stops.length, 6, `expected 6 stops, got ${six!.stops.map((s) => s.label)}`);
assert.deepEqual(
  six!.stops.map((s) => s.label),
  ["Kids' Practice", 'Work', 'Shopping', 'Work', 'Gym', 'Pick Up The Kids']
);

const compound = parseCompoundHouseholdIntent(sixStop);
assert.equal(compound.length, 1);
assert.equal(String(compound[0]!.type), 'create_itinerary');
assert.ok(Array.isArray(compound[0]!.stops));
assert.equal((compound[0]!.stops as unknown[]).length, 6);
assert.ok(!compound.some((a) => String(a.type) === 'add_grocery'));
assert.ok(!compound.some((a) => String(a.type) === 'create_calendar_event'));

const twoStop = parseItineraryIntent('create an itinerary: school then gym');
assert.ok(twoStop);
assert.equal(twoStop!.stops.length, 2);

const withSaved = {
  type: 'create_itinerary',
  title: 'Errands',
  stops: [
    { label: 'Work', kind: 'work', address: '100 Main St', placeQuery: 'work' },
    { label: 'Unknown Cafe', kind: 'other', placeQuery: 'Unknown Cafe' },
  ],
};
const playlist = mapUiActionsToPlaylist([withSaved]);
const stage = playlist.find((b) => b.scene === 'itinerary_stage');
assert.ok(stage);
assert.equal(stage!.payload.stops?.length, 2);
assert.equal(stage!.payload.stops?.[0]?.address, '100 Main St');
assert.equal(stage!.payload.stops?.[0]?.needsAddress, false);
assert.equal(stage!.payload.stops?.[1]?.needsAddress, true);

const section2 =
  'create me an itinerary: kids practice, then work, then shopping on my break, then the gym, then pick up the kids';
const s2 = parseCompoundHouseholdIntent(section2);
assert.equal(String(s2[0]?.type), 'create_itinerary');
assert.ok(((s2[0]?.stops as unknown[])?.length ?? 0) >= 5);
assert.ok(!s2.some((a) => String(a.type) === 'add_grocery'));
assert.ok(!s2.some((a) => String(a.type) === 'create_calendar_event'));

console.log('itinerary-intent.test.ts ok');
