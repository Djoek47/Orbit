import assert from 'node:assert/strict';

import {
  planTourScroll,
  targetScrolls,
  tourScreenKey,
  tourVisibleBand,
  TOUR_CARD_ROOM,
} from '@/lib/tour/tour-scroll';

const screenH = 874;
const insets = { top: 59, bottom: 34 };
const band = tourVisibleBand(screenH, insets);

// Keys.
assert.equal(tourScreenKey('/(tabs)'), 'home');
assert.equal(tourScreenKey('/(tabs)/index'), 'home');
assert.equal(tourScreenKey('/'), 'home');
assert.equal(tourScreenKey('/(tabs)/tasks'), 'tasks');
assert.equal(tourScreenKey('/(tabs)/groceries?x=1'), 'groceries');

// Chrome never scrolls.
assert.equal(targetScrolls('tabbar.tasks'), false);
assert.equal(targetScrolls('header.settings'), false);
assert.equal(targetScrolls('tour.finish'), false);
assert.equal(targetScrolls('home.groceryCard'), true);

// Already well placed: leave the page alone.
assert.equal(
  planTourScroll({ target: { x: 16, y: band.top + 20, width: 350, height: 120 }, offset: 300, screenH, insets }),
  null
);

// The Groceries miss: page already scrolled 400, card sits under the tab bar. The fix must add
// the live offset — not scroll to the on-screen y as if the page were at the top.
{
  const target = { x: 16, y: 780, width: 170, height: 150 };
  const next = planTourScroll({ target, offset: 400, screenH, insets })!;
  assert.ok(next > 400, `scrolls further down, got ${next}`);
  // After scrolling by (next - 400) the target's window y moves up by the same amount.
  const landedTop = target.y - (next - 400);
  const stack = target.height + 12 + TOUR_CARD_ROOM;
  const expected = band.top + (band.height - stack) / 2;
  assert.ok(Math.abs(landedTop - expected) <= 1, `centred: ${landedTop} vs ${expected}`);
}

// Target above the band (scrolled past): scrolls back up, never below 0.
{
  const next = planTourScroll({ target: { x: 16, y: 20, width: 350, height: 100 }, offset: 60, screenH, insets });
  assert.equal(next, 0);
}

// A target taller than the room left sits at the top of the band.
{
  const target = { x: 0, y: 600, width: 390, height: 700 };
  const next = planTourScroll({ target, offset: 0, screenH, insets })!;
  assert.equal(target.y - next, band.top + 8);
}

console.log('tour-scroll: ok');
