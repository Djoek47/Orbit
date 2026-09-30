import assert from 'node:assert/strict';

import { shoppingBannerList, shoppingBannerState } from '@/lib/grocery/shopping-banner-copy';

// Mid-run: how far along, where to head next, and what's still to get.
const mid = shoppingBannerState({
  done: 3,
  total: 9,
  nextAisle: 'Dairy & Eggs',
  runLabel: 'Friday run',
  remaining: ['Milk', 'Cheese'],
});
assert.equal(mid.title, 'Friday run');
assert.equal(mid.subtitle, '3 of 9 · Dairy & Eggs\nMilk\nCheese');
assert.equal(mid.progressBar?.progress, 3 / 9);

// The list is a checklist, capped, with the rest counted.
assert.deepEqual(shoppingBannerList(['Milk', 'Eggs']), ['Milk', 'Eggs']);
assert.deepEqual(shoppingBannerList(['a', 'b', 'c', 'd', 'e', 'f']), [
  'a',
  'b',
  'c',
  'd',
  'e',
  '+1 more',
]);
assert.deepEqual(shoppingBannerList([' Milk ', '', '  ']), ['Milk']);
// Ticked-off items are simply not passed in, so the banner drops them like the list does.
assert.equal(
  shoppingBannerState({ done: 4, total: 9, nextAisle: 'Pantry', remaining: ['Rice'] }).subtitle,
  '4 of 9 · Pantry\nRice'
);

// Finished.
const done = shoppingBannerState({ done: 9, total: 9, runLabel: 'Friday run' });
assert.equal(done.subtitle, 'All picked up — nice one');
assert.equal(done.progressBar?.progress, 1);

// Nothing on the list: no divide-by-zero, and a title either way.
const empty = shoppingBannerState({ done: 0, total: 0 });
assert.equal(empty.title, 'Shopping run');
assert.equal(empty.progressBar?.progress, 0);

// No aisle known yet.
assert.equal(shoppingBannerState({ done: 1, total: 4 }).subtitle, '1 of 4 · Keep going');

console.log('shopping-banner-copy: ok');
