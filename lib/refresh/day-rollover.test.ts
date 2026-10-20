import assert from 'node:assert/strict';

import {
  dayHasRolled,
  dayKey,
  freshnessLabel,
  msUntilNextDay,
  REFRESH_DEBOUNCE_MS,
  shouldRefreshOnForeground,
} from './day-rollover';

// ── The day's key ─────────────────────────────────────────────────────────────
// Local, not UTC: a household lives in one timezone, and 8pm in Montréal is already tomorrow
// in UTC. Keying on UTC would roll the day over dinner.
const evening = new Date(2026, 9, 7, 20, 30);
assert.equal(dayKey(evening), '2026-10-07');
assert.equal(dayKey(new Date(2026, 0, 1, 0, 0)), '2026-01-01', 'months and days are padded');
assert.equal(dayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');

// ── Has the day moved on ──────────────────────────────────────────────────────
assert.equal(dayHasRolled('2026-10-07', evening), false);
assert.equal(dayHasRolled('2026-10-06', evening), true);
// First look of a session: run the catch-up rather than assume someone else did.
assert.equal(dayHasRolled(null, evening), true);
assert.equal(dayHasRolled('', evening), true);
assert.equal(dayHasRolled('nonsense', evening), true);

// Across midnight, which is the case the whole module exists for.
const justBefore = new Date(2026, 9, 7, 23, 59, 30);
const justAfter = new Date(2026, 9, 8, 0, 0, 30);
assert.equal(dayHasRolled(dayKey(justBefore), justBefore), false);
assert.equal(dayHasRolled(dayKey(justBefore), justAfter), true, 'midnight rolls it');

// ── Scheduling the rollover ───────────────────────────────────────────────────
const noon = new Date(2026, 9, 7, 12, 0, 0);
const untilMidnight = msUntilNextDay(noon);
assert.ok(untilMidnight > 11.9 * 3_600_000 && untilMidnight < 12.1 * 3_600_000, 'about 12 hours');

// A timer set for exactly midnight can fire a hair early and roll the same day twice.
const aSecondBefore = new Date(2026, 9, 7, 23, 59, 59);
assert.ok(msUntilNextDay(aSecondBefore) >= 1000, 'never schedules for right now');
assert.ok(msUntilNextDay(new Date(2026, 9, 7, 23, 59, 59, 999)) >= 1000);

// ── Debouncing the foreground ─────────────────────────────────────────────────
// A notification tap can produce several foreground events in a second.
assert.equal(shouldRefreshOnForeground(null, 1_000_000), true, 'first time always runs');
assert.equal(shouldRefreshOnForeground(1_000_000, 1_000_500), false, 'half a second later');
assert.equal(
  shouldRefreshOnForeground(1_000_000, 1_000_000 + REFRESH_DEBOUNCE_MS),
  true,
  'exactly at the boundary'
);
assert.equal(shouldRefreshOnForeground(1_000_000, 1_000_000 + REFRESH_DEBOUNCE_MS - 1), false);

// ── Freshness ─────────────────────────────────────────────────────────────────
const t = 1_000_000_000;
assert.equal(freshnessLabel(null, t), '', 'nothing to say before the first load');
assert.equal(freshnessLabel(t, t), 'just now');
assert.equal(freshnessLabel(t - 59_000, t), 'just now');
assert.equal(freshnessLabel(t - 60_000, t), '1m ago');
assert.equal(freshnessLabel(t - 4 * 60_000, t), '4m ago');
assert.equal(freshnessLabel(t - 59 * 60_000, t), '59m ago');
assert.equal(freshnessLabel(t - 60 * 60_000, t), '1h ago');
assert.equal(freshnessLabel(t - 5 * 3_600_000, t), '5h ago');
assert.equal(freshnessLabel(t - 26 * 3_600_000, t), 'yesterday');
// A clock that jumped backwards must not print a negative age.
assert.equal(freshnessLabel(t + 5000, t), 'just now');

console.log('day-rollover: ok');
