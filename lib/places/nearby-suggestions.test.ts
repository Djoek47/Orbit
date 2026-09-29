import assert from 'node:assert/strict';

import {
  nearbyQuery,
  type OverpassElement,
  pickSuggestions,
  suggestionsFromElements,
  type NearbySuggestion,
} from '@/lib/places/nearby-suggestions';

const HOME = { lat: 45.5, lng: -73.6 };

// ~800 m east of home at this latitude.
const near = { lat: 45.5, lon: -73.5898 };
const far = { lat: 45.52, lon: -73.6 };

const elements: OverpassElement[] = [
  { type: 'node', id: 1, ...near, tags: { name: 'Metro', shop: 'supermarket', 'addr:housenumber': '12', 'addr:street': 'Rue Saint-Denis' } },
  { type: 'way', id: 2, center: { lat: far.lat, lon: far.lon }, tags: { name: 'Parc Laurier', leisure: 'park' } },
  { type: 'node', id: 3, ...near, tags: { name: 'École Saint-Luc', amenity: 'school' } },
  // Same supermarket mapped twice — only one card.
  { type: 'way', id: 4, center: { lat: near.lat, lon: near.lon }, tags: { name: 'Metro', shop: 'supermarket' } },
  // No name: skipped.
  { type: 'node', id: 5, ...near, tags: { shop: 'supermarket' } },
  // Nothing we file: skipped.
  { type: 'node', id: 6, ...near, tags: { name: 'Bureau', office: 'company' } },
];

const list = suggestionsFromElements(elements, HOME);
assert.deepEqual(
  list.map((s) => s.name),
  ['Metro', 'École Saint-Luc', 'Parc Laurier'],
  'named, deduped, nearest first'
);

const metro = list[0]!;
assert.equal(metro.kind, 'shop');
assert.equal(metro.address, '12 Rue Saint-Denis');
assert.match(metro.detail, /^Grocery · \d+ m$/);
assert.ok(metro.distanceMeters > 700 && metro.distanceMeters < 900, `800m-ish, got ${metro.distanceMeters}`);

// Over a kilometre reads in km.
assert.match(list[2]!.detail, /^Park · \d\.\d km$/);

// A place already saved never comes back as a suggestion.
assert.deepEqual(
  pickSuggestions(list, ['metro']).map((s) => s.name),
  ['École Saint-Luc', 'Parc Laurier']
);

// Variety: at most two of a kind before other kinds get a turn.
const many: NearbySuggestion[] = Array.from({ length: 6 }, (_, i): NearbySuggestion => ({
  id: `s${i}`,
  name: `Shop ${i}`,
  address: '',
  kind: 'shop' as const,
  emoji: '🛒',
  lat: 0,
  lng: 0,
  distanceMeters: i * 10,
  detail: 'Grocery',
})).concat([
  { id: 'p1', name: 'Playground', address: '', kind: 'practice', emoji: '🛝', lat: 0, lng: 0, distanceMeters: 900, detail: 'Playground' },
]);
const picked = pickSuggestions(many, [], 3);
assert.deepEqual(picked.map((s) => s.name), ['Shop 0', 'Shop 1', 'Playground']);

// The query asks for every kind, around the point given.
const query = nearbyQuery(HOME.lat, HOME.lng);
for (const needle of ['supermarket', 'pharmacy', 'school', 'playground', 'fitness_centre', 'cafe', 'library']) {
  assert.ok(query.includes(needle), `query covers ${needle}`);
}
assert.ok(query.includes('around:3000,45.5,-73.6'));

console.log('nearby-suggestions: ok');
