import assert from 'node:assert/strict';

import { shoppingBannerState } from '@/lib/grocery/shopping-banner-copy';

// Mid-run: how far along, and where to head next.
const mid = shoppingBannerState({ done: 3, total: 9, nextAisle: 'Dairy & Eggs', runLabel: 'Friday run' });
assert.equal(mid.title, 'Friday run');
assert.equal(mid.subtitle, '3 of 9 · Dairy & Eggs');
assert.equal(mid.progressBar?.progress, 3 / 9);

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
