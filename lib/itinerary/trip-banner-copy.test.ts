/**
 * Run: npx --yes tsx --test lib/itinerary/trip-banner-copy.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { tripBannerState } from './trip-banner-copy';

test('trip banner packs current stop for Lock Screen check-off', () => {
  const state = tripBannerState({
    tripTitle: 'Family run',
    index: 0,
    total: 3,
    currentLabel: 'Cuir Dimitri',
    remainingStops: [
      { id: 'stop-1', label: 'Cuir Dimitri', emoji: '🛒' },
      { id: 'stop-2', label: 'Marché Legendre', emoji: '🛒' },
    ],
  });
  assert.equal(state.title, 'Family run');
  assert.match(state.subtitle, /Stop 1 of 3/);
  assert.match(state.subtitle, /#id:stop-1\|/);
  assert.match(state.subtitle, /Marché Legendre/);
});

test('arrived phase shows in the banner head', () => {
  const state = tripBannerState({
    tripTitle: 'Family run',
    index: 1,
    total: 3,
    currentLabel: 'Metro',
    arrived: true,
    remainingStops: [{ id: 'stop-2', label: 'Metro', emoji: '🛒' }],
  });
  assert.match(state.subtitle, /Arrived/);
});

test('en-route distance shows like Uber / Waze', () => {
  const state = tripBannerState({
    tripTitle: 'Errands',
    index: 0,
    total: 3,
    currentLabel: 'Metro',
    distanceMeters: 840,
    remainingStops: [{ id: 's1', label: 'Metro', emoji: '🛒' }],
  });
  assert.match(state.subtitle, /840 m/);
});

test('arrived grocery stop invites opening the list', () => {
  const state = tripBannerState({
    tripTitle: 'Errands',
    index: 0,
    total: 3,
    currentLabel: 'Metro',
    arrived: true,
    hasShoppingList: true,
    remainingStops: [{ id: 's1', label: 'Metro', emoji: '🛒' }],
  });
  assert.match(state.subtitle, /Arrived · open list/);
});
