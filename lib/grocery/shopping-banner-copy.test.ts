/**
 * Shopping banner copy + Lock Screen check-off packing.
 * Run: npx tsx lib/grocery/shopping-banner-copy.test.ts
 */
import assert from 'node:assert/strict';

import {
  packBannerItem,
  shoppingBannerList,
  shoppingBannerPackedSubtitle,
  shoppingBannerState,
  unpackBannerItem,
} from './shopping-banner-copy';

const mid = shoppingBannerState({
  done: 3,
  total: 8,
  nextAisle: 'Dairy',
  remaining: ['Milk', 'Cheese'],
});
assert.match(mid.title, /Shopping run|run/);
assert.match(mid.subtitle, /3 of 8/);
assert.ok(mid.progressBar.progress > 0 && mid.progressBar.progress < 1);

// One Lock Screen page shows BANNER_PAGE_SIZE (2) rows, then "+N more".
assert.deepEqual(shoppingBannerList(['Milk', 'Eggs']), ['Milk', 'Eggs']);
assert.deepEqual(shoppingBannerList(['a', 'b', 'c', 'd', 'e', 'f']), ['a', 'b', '+4 more']);
assert.deepEqual(shoppingBannerList(['a', 'b', 'c', 'd', 'e', 'f'], 3, 1), ['d', 'e', 'f']);
assert.deepEqual(shoppingBannerList([' Milk ', '', '  ']), ['Milk']);

assert.equal(
  shoppingBannerPackedSubtitle('0 of 8 · Dairy', ['Milk', 'Eggs'], 0),
  '0 of 8 · Dairy\nMilk\nEggs\n#p0'
);

assert.match(
  shoppingBannerState({ done: 4, total: 9, nextAisle: 'Pantry', remaining: ['Rice'] }).subtitle,
  /Rice/
);

const done = shoppingBannerState({ done: 9, total: 9, runLabel: 'Friday run' });
assert.equal(done.title, 'Friday run');
assert.match(done.subtitle, /All picked up/);

const empty = shoppingBannerState({ done: 0, total: 0 });
assert.ok(empty);

assert.equal(shoppingBannerState({ done: 1, total: 4 }).subtitle, '1 of 4 · Keep going');

// Ids travel with the label so Lock Screen taps can sync back.
assert.equal(packBannerItem({ id: 'g1', label: '🧀 Milk' }), '#id:g1|🧀 Milk');
assert.deepEqual(unpackBannerItem('#id:g1|🧀 Milk'), { id: 'g1', label: '🧀 Milk' });
assert.deepEqual(unpackBannerItem('Plain Eggs'), { id: '', label: 'Plain Eggs' });

const withIds = shoppingBannerPackedSubtitle(
  '1 of 3 · Dairy',
  [
    { id: 'a', label: '🥛 Milk' },
    { id: 'b', label: '🥚 Eggs' },
  ],
  0
);
assert.equal(withIds, '1 of 3 · Dairy\n#id:a|🥛 Milk\n#id:b|🥚 Eggs\n#p0');

const fromItems = shoppingBannerState({
  done: 0,
  total: 2,
  nextAisle: 'Dairy',
  remainingItems: [{ id: 'x', label: '🧀 Cheese' }],
});
assert.match(fromItems.subtitle, /#id:x\|🧀 Cheese/);
assert.match(fromItems.subtitle, /#p0/);

console.log('shopping-banner-copy: ok');
