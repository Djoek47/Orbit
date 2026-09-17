/**
 * Saved places mapping + missing-table fallback.
 * Run: npx --yes tsx lib/places/saved-places.test.ts
 */
import assert from 'node:assert/strict';

import {
  isMissingPlacesTableError,
  mapSavedPlaceRow,
  mergeHydratedPlaces,
  normalizeSavedPlaceKind,
  savedPlaceToRow,
} from './saved-places';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

{
  assert.equal(normalizeSavedPlaceKind('home'), 'home');
  assert.equal(normalizeSavedPlaceKind('CLOTHING'), 'clothing');
  assert.equal(normalizeSavedPlaceKind('stadium'), 'custom');
  pass('kind normalize');
}

{
  const place = mapSavedPlaceRow(
    {
      client_key: 'place-home',
      name: 'Home',
      kind: 'home',
      address: '12 Oak St',
      place_query: '12 Oak Street',
      lat: 45.5,
      lng: -73.6,
      emoji: '🏠',
      is_favorite: true,
      pickup_item_names: ['Milk', ''],
    },
    'fallback'
  );
  assert.equal(place.id, 'place-home');
  assert.equal(place.kind, 'home');
  assert.deepEqual(place.pickupItemNames, ['Milk']);
  const row = savedPlaceToRow('6f1c2e90-4b3a-4d21-9c8e-1a2b3c4d5e6f', place, 0);
  assert.equal(row.client_key, 'place-home');
  assert.equal(row.household_id, '6f1c2e90-4b3a-4d21-9c8e-1a2b3c4d5e6f');
  assert.equal(row.is_favorite, true);
  pass('row round-trip fields');
}

{
  assert.deepEqual(mergeHydratedPlaces(null, [{ id: 'demo' } as never]), [{ id: 'demo' }]);
  assert.deepEqual(mergeHydratedPlaces([], [{ id: 'demo' } as never]), []);
  assert.deepEqual(mergeHydratedPlaces([{ id: 'saved' } as never], [{ id: 'demo' } as never]), [
    { id: 'saved' },
  ]);
  pass('hydrate prefers stored list, including empty');
}

{
  assert.equal(isMissingPlacesTableError({ code: 'PGRST205' }), true);
  assert.equal(isMissingPlacesTableError({ code: '42P01' }), true);
  assert.equal(
    isMissingPlacesTableError({
      message: "Could not find the table 'public.household_saved_places' in the schema cache",
    }),
    true
  );
  assert.equal(isMissingPlacesTableError({ code: '42501', message: 'permission denied' }), false);
  pass('missing-table detection');
}

console.log('\nsaved-places tests passed');
