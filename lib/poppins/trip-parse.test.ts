import assert from 'node:assert/strict';

import { isTripUtterance, parseTripUtterance, tripSpan } from '@/lib/poppins/trip-parse';

const NOW = new Date(2026, 8, 30, 15, 50); // Wed 30 Sep 2026, 3:50 PM
const PLACES = [
  { id: 'p1', name: 'Parc Jarry', address: 'Parc Jarry', kind: 'practice' },
  { id: 'p2', name: 'Work', address: '1250 René-Lévesque O', kind: 'work' },
  { id: 'p3', name: 'Économie du Plateau', address: 'Économie du Plateau', kind: 'practice' },
];

// The design's six-stop run.
const six = 'practice, then work, shopping on my break, back to work, gym, then pick up the kids';
assert.equal(isTripUtterance(six), true);
const run = parseTripUtterance(`starting at 4, ${six}`, { places: PLACES, now: NOW });
assert.ok(run);
assert.equal(run!.title, 'Wednesday run');
assert.equal(run!.stops.length, 6);
assert.deepEqual(
  run!.stops.map((s) => [s.time, s.label, s.kind]),
  [
    ['16:00', 'Practice', 'practice'],
    ['17:15', 'Work', 'work'],
    ['19:00', 'Shopping', 'shop'],
    ['19:45', 'Back to work', 'work'],
    ['21:00', 'Gym', 'gym'],
    ['22:15', 'Pick up the kids', 'pickup'],
  ]
);
assert.equal(run!.stops[1]!.address, '1250 René-Lévesque O');
assert.equal(run!.stops[3]!.address, '1250 René-Lévesque O', 'back to work reuses the work stop');
assert.equal(run!.stops[5]!.needsAddress, true, 'the kids need an address');
assert.equal(tripSpan(run!.stops), '6h 25m');
assert.equal(parseTripUtterance(six, { places: PLACES, now: NOW })!.stops[0]!.time, '16:00', 'no start said: the next quarter hour');

// More than six is fine.
const eight = parseTripUtterance(
  'plan a trip: school, then the bank, then the post office, then the pharmacy, then costco, then the gym, then the library, then home',
  { now: NOW }
);
assert.equal(eight!.stops.length, 8);
assert.equal(eight!.stops[0]!.label, 'School');

// Classic cues still work; tomorrow is the trip's day.
const two = parseTripUtterance('plan a trip to the gym then the grocery store tomorrow', { now: NOW });
assert.equal(two!.stops.length, 2);
assert.equal(two!.date, '2026-10-01');
assert.equal(two!.title, 'Thursday run');

// A stop's own time wins and the rest follow it.
const fixed = parseTripUtterance('errands: bank, then gym at 6, then home', { now: NOW });
assert.equal(fixed!.stops[1]!.time, '18:00');
assert.equal(fixed!.stops[2]!.time, '19:15');

// Not trips.
for (const s of [
  'clean the dishes then vacuum',
  'add milk, eggs and bread',
  'dentist for Noah next Thursday at half four',
  'walk the dog then feed the cat',
]) {
  assert.equal(isTripUtterance(s), false, `not a trip: ${s}`);
}

console.log('trip-parse: ok');
