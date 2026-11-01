import assert from 'node:assert/strict';

import type { ActEvent } from './act-events';
import {
  computeCreditBreakdown,
  creditEvents,
  daysOfCreditsLeft,
  formatCredits,
  SPEND_META,
  SPEND_ORDER,
  spendGroupOf,
} from './credit-breakdown';

const NOW = new Date(2026, 8, 30, 14, 0, 0); // Wed 30 Sep 2026

function act(partial: Partial<ActEvent> & { at: string }): ActEvent {
  return {
    id: `a-${partial.at}-${Math.random()}`,
    memberId: 'm1',
    memberName: 'Alex',
    actKind: 'task',
    voice: 'quiet',
    control: 'guided',
    tokens: 1,
    outcome: 'committed',
    utteranceChars: 20,
    turns: 1,
    beatsPlayed: 1,
    slotsFromSpeech: 1,
    slotsFromTouch: 0,
    slotsInherited: 0,
    latencyMs: 400,
    ...partial,
  };
}

// Every act kind lands in a group, and every group has a look.
for (const kind of [
  'task',
  'grocery',
  'event',
  'homework',
  'itinerary_stop',
  'place_save',
  'complete',
  'reward',
  'coach',
] as const) {
  const group = spendGroupOf(kind);
  assert.ok(SPEND_ORDER.includes(group), `${kind} → ${group} is stackable`);
  assert.ok(SPEND_META[group].label, `${group} has a label`);
}
assert.equal(spendGroupOf('homework'), 'tasks');
assert.equal(spendGroupOf('itinerary_stop'), 'places');

// Only committed acts are charged, so only those reach the chart.
const raw: ActEvent[] = [
  act({ at: '2026-09-30T09:00:00.000Z', actKind: 'task', tokens: 1 }),
  act({ at: '2026-09-30T09:05:00.000Z', actKind: 'grocery', tokens: 1 }),
  act({ at: '2026-09-30T09:06:00.000Z', actKind: 'grocery', tokens: 35, voice: 'spoken' }),
  act({ at: '2026-09-30T09:10:00.000Z', actKind: 'event', tokens: 1, outcome: 'undone' }),
  act({ at: '2026-09-30T09:11:00.000Z', actKind: 'event', tokens: 1, outcome: 'vetoed' }),
  act({ at: '2026-09-30T09:12:00.000Z', actKind: 'task', tokens: 0 }),
  act({ at: 'not-a-date', actKind: 'task', tokens: 4 }),
];
const events = creditEvents(raw);
assert.equal(events.length, 3, 'undone, vetoed, zero-cost and unparseable rows are out');
assert.equal(events.filter((e) => e.spoken).length, 1);

const week = computeCreditBreakdown(events, 'W', NOW);
assert.equal(week.totals.credits, 37);
assert.equal(week.totals.actions, 3);
assert.equal(week.totals.spokenCredits, 35);
assert.equal(week.totals.quietCredits, 2);
assert.equal(week.buckets.length, 7);
// Everything happened today, which is the last bar.
assert.equal(week.buckets[6]!.credits, 37);
assert.equal(week.buckets[0]!.credits, 0);
assert.equal(week.busiest?.credits, 37);

// Grouped, biggest first, and each bucket carries its own split.
assert.deepEqual(
  week.byGroup.map((row) => row.group),
  ['groceries', 'tasks']
);
assert.equal(week.byGroup[0]!.credits, 36);
assert.equal(week.buckets[6]!.byGroup.groceries?.actions, 2);
assert.equal(week.buckets[6]!.byGroup.tasks?.credits, 1);
assert.equal(week.buckets[6]!.byGroup.calendar, undefined);

// Per person.
assert.deepEqual(week.byMember, [{ name: 'Alex', credits: 37, actions: 3 }]);

// A week's headline is the daily average; a day's is the total.
assert.equal(week.headline.kind, 'average');
assert.ok(Math.abs(week.headline.credits - 37 / 7) < 1e-9);
const day = computeCreditBreakdown(events, 'D', NOW);
assert.equal(day.headline.kind, 'total');
assert.equal(day.headline.credits, 37);
assert.equal(day.buckets.length, 24);

// Ranges all build, and none of them drops a charged act that falls inside.
for (const range of ['D', 'W', 'M', '6M', 'Y'] as const) {
  const breakdown = computeCreditBreakdown(events, range, NOW);
  assert.equal(breakdown.totals.credits, 37, `${range} keeps every act`);
  assert.ok(breakdown.span.length > 0, `${range} has a span`);
  assert.equal(
    breakdown.buckets.reduce((sum, b) => sum + b.credits, 0),
    37,
    `${range} bars sum to the total`
  );
}
assert.match(computeCreditBreakdown(events, 'D', NOW).span, /^Today, Sep 30$/);

// An act older than the range is excluded rather than piled onto the first bar.
const old = creditEvents([act({ at: '2025-01-02T09:00:00.000Z', tokens: 9 })]);
assert.equal(computeCreditBreakdown(old, 'W', NOW).totals.credits, 0);
assert.equal(computeCreditBreakdown([], 'W', NOW).busiest, null);
assert.equal(computeCreditBreakdown([], 'W', NOW).headline.credits, 0);

// Number formatting.
assert.equal(formatCredits(37), '37');
assert.equal(formatCredits(4.28), '4.3');
assert.equal(formatCredits(12.6), '13');
assert.equal(formatCredits(0), '0');

// How long what's left will last.
assert.equal(daysOfCreditsLeft(100, 10), 10);
assert.equal(daysOfCreditsLeft(100, 33), 3);
assert.equal(daysOfCreditsLeft(100, 0), null);
assert.equal(daysOfCreditsLeft(0, 10), null);

console.log('credit-breakdown: ok');
