/**
 * Day strip — bar positions, the clash sentence, and which events share the day.
 * Run: npm run test:day-strip
 */
import assert from 'node:assert/strict';

import {
  clashSentence,
  dayStripItems,
  eventLocalDayKey,
  layoutDayStrip,
  possessiveTitle,
  timeLabelMinutes,
  timeRangeLabel,
  type DayStripSource,
} from './day-strip';
import { readEventSentence } from './event-sentence';

const now = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026
const iso = (y: number, mo: number, d: number, h: number, m = 0) => new Date(y, mo, d, h, m).toISOString();

// ── Time labels ──────────────────────────────────────────────────────
assert.equal(timeLabelMinutes('16:30'), 16 * 60 + 30);
assert.equal(timeLabelMinutes('4:30 PM'), 16 * 60 + 30);
assert.equal(timeLabelMinutes('5 pm'), 17 * 60);
assert.equal(timeLabelMinutes('12:00 AM'), 0);
assert.equal(timeLabelMinutes('All day'), null);
assert.equal(timeLabelMinutes(''), null);
assert.equal(timeLabelMinutes('4'), null, 'a bare number is not a time');

// ── Which day an event sits on (local, not UTC) ──────────────────────
assert.equal(eventLocalDayKey({ date: 'Thu, Oct 1', startsAt: iso(2026, 9, 1, 21) }, now), '2026-10-01');
assert.equal(eventLocalDayKey({ date: 'Thu, Oct 1' }, now), '2026-10-01');
assert.equal(eventLocalDayKey({ date: 'Today' }, now), '2026-09-25');
assert.equal(eventLocalDayKey({ date: 'Tomorrow' }, now), '2026-09-26');
assert.equal(eventLocalDayKey({ date: '2026-10-03' }, now), '2026-10-03');
assert.equal(eventLocalDayKey({ date: 'someday' }, now), null);

const events: DayStripSource[] = [
  { id: 'piano', title: 'Piano', date: 'Thu, Oct 1', time: '6:00 PM', startsAt: iso(2026, 9, 1, 18), responsible: 'Mia' },
  { id: 'swim', title: 'Swim', date: 'Thu, Oct 1', time: '15:00', startsAt: iso(2026, 9, 1, 15), responsible: 'Noah' },
  { id: 'fair', title: 'Book fair', date: 'Thu, Oct 1', time: 'All day', startsAt: iso(2026, 9, 1, 12) },
  { id: 'other', title: 'Soccer', date: 'Fri, Oct 2', time: '4:00 PM', startsAt: iso(2026, 9, 2, 16) },
];

const items = dayStripItems(events, '2026-10-01', now);
assert.deepEqual(
  items.map((i) => [i.id, i.start, i.end]),
  [
    ['swim', 900, 960],
    ['piano', 1080, 1140],
  ],
  'same-day timed events only, sorted, default 1h long'
);

// ── Clash sentence ───────────────────────────────────────────────────
assert.equal(
  clashSentence({ title: 'Dentist', start: 16 * 60 + 30, end: 17 * 60 + 15 }, items),
  "Clashes with nothing. Mia's piano is next, at 6 PM."
);
assert.equal(
  clashSentence({ title: 'Dentist', start: 17 * 60 + 30, end: 18 * 60 + 30 }, items),
  'Clashes with Piano (6 PM).'
);
assert.equal(
  clashSentence({ title: 'Dentist', start: 14 * 60 + 30, end: 15 * 60 + 30 }, items),
  "Clashes with Swim (3 PM). Mia's piano is next, at 6 PM."
);
assert.equal(clashSentence({ title: 'Dentist', start: 20 * 60 }, items), 'Clashes with nothing.');
assert.equal(clashSentence({ title: 'Dentist', start: 9 * 60 }, []), 'Clashes with nothing.');
// Touching ends don't clash.
assert.equal(
  clashSentence({ title: 'Dentist', start: 16 * 60, end: 17 * 60 }, items),
  "Clashes with nothing. Mia's piano is next, at 6 PM."
);
assert.equal(clashSentence({ title: 'Trip', allDay: true }, []), 'Nothing else that day.');
assert.equal(
  clashSentence({ title: 'Trip', allDay: true }, items),
  'All day. Also that day: Swim (3 PM) and Piano (6 PM).'
);

// ── Possessive ───────────────────────────────────────────────────────
assert.equal(possessiveTitle({ title: 'Piano', who: 'Mia' }), "Mia's piano");
assert.equal(possessiveTitle({ title: 'PTA meeting', who: 'Ama' }), "Ama's PTA meeting");
assert.equal(possessiveTitle({ title: 'Mia piano', who: 'Mia' }), 'Mia piano');
assert.equal(possessiveTitle({ title: 'Piano' }), 'Piano');

// ── Layout ───────────────────────────────────────────────────────────
const layout = layoutDayStrip({ title: 'Dentist', start: 16 * 60 + 30, end: 17 * 60 + 15 }, items);
assert.equal(layout.label, 'THAT AFTERNOON');
assert.equal(layout.from, 12 * 60);
assert.equal(layout.to, 19 * 60);
const byId = Object.fromEntries(layout.bars.map((b) => [b.id, b]));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
assert.ok(near(byId.new!.left, 270 / 420), 'new bar starts at 4:30 across 12–7');
assert.ok(near(byId.new!.width, 45 / 420));
assert.equal(byId.new!.kind, 'new');
assert.equal(byId.piano!.kind, 'next');
assert.equal(byId.swim!.kind, 'other');
assert.ok(near(byId.swim!.left, 180 / 420));

const clashing = layoutDayStrip({ title: 'Dentist', start: 17 * 60 + 30 }, items);
assert.equal(clashing.label, 'THAT EVENING');
assert.equal(clashing.bars.find((b) => b.id === 'piano')!.kind, 'clash');
assert.equal(clashing.bars.find((b) => b.id === 'swim'), undefined, 'swim ends before the evening window');

const morning = layoutDayStrip({ title: 'Run', start: 6 * 60 }, items);
assert.equal(morning.label, 'THAT MORNING');
assert.equal(morning.from, 6 * 60, 'window stretches back to fit an early start');
assert.ok(near(morning.bars.find((b) => b.id === 'new')!.left, 0));

const allDay = layoutDayStrip({ title: 'Trip', allDay: true }, items);
assert.equal(allDay.label, 'THAT DAY');
assert.equal(allDay.bars.some((b) => b.kind === 'new'), false);
assert.equal(allDay.bars.length, 2);

for (const bar of [...layout.bars, ...clashing.bars, ...morning.bars]) {
  assert.ok(bar.left >= 0 && bar.left + bar.width <= 1 + 1e-9, `${bar.id} stays inside the strip`);
}

assert.equal(timeRangeLabel('16:30', '17:15'), '4:30 – 5:15 PM');
assert.equal(timeRangeLabel('11:30', '12:15'), '11:30 AM – 12:15 PM');
assert.equal(timeRangeLabel('09:00', '10:00'), '9 – 10 AM');
assert.equal(timeRangeLabel('16:30'), '4:30 PM');
assert.equal(timeRangeLabel(undefined), '');

console.log('day-strip: ok');

// ── The one-line sentence (lib/calendar/event-sentence.ts) ───────────
const family = [
  { id: 'n', name: 'Noah' },
  { id: 'm', name: 'Mia' },
  { id: 'a', name: 'Ama' },
];
const dentist = readEventSentence('Dentist for Noah next Thursday at half four', family, now);
assert.equal(dentist.title, 'Dentist');
assert.equal(dentist.memberId, 'n');
assert.equal(dentist.dateKey, '2026-10-01');
assert.equal(dentist.time, '16:30');

const piano = readEventSentence("Mia's piano tomorrow at 5", family, now);
assert.equal(piano.title, 'Piano');
assert.equal(piano.memberId, 'm');
assert.equal(piano.dateKey, '2026-09-26');
assert.equal(piano.time, '17:00');

const curly = readEventSentence('Mia’s Recital on the 14th at 6:30pm', family, now);
assert.equal(curly.title, 'Recital');
assert.equal(curly.memberId, 'm');
assert.equal(curly.dateKey, '2026-10-14');
assert.equal(curly.time, '18:30');

const plain = readEventSentence('Lunch with Ama at noon', family, now);
assert.equal(plain.title, 'Lunch with Ama', 'only "for X" / "X\'s" pick who it is for');
assert.equal(plain.memberId, undefined);

const casing = readEventSentence('PTA meeting at Riverside School friday 7pm', family, now);
assert.equal(casing.title, 'PTA meeting at Riverside School');
assert.equal(casing.time, '19:00');

const allDayTrip = readEventSentence('Field trip all day friday', family, now);
assert.equal(allDayTrip.title, 'Field trip');
assert.equal(allDayTrip.allDay, true);

assert.equal(readEventSentence('', family, now).title, '');

console.log('event-sentence: ok');
