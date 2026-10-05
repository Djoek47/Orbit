import assert from 'node:assert/strict';

import {
  beatAt,
  chapterOf,
  chapterStartMs,
  DEMO_BEATS,
  DEMO_CHAPTERS,
  DEMO_SPEAKERS,
  demoOffsets,
  demoProgress,
  demoTotalMs,
  formatDemoClock,
  type DemoChapterId,
} from './how-it-works-script';

// Every beat is playable: an id, a line, a duration that isn't a blink or a stall.
assert.equal(new Set(DEMO_BEATS.map((b) => b.id)).size, DEMO_BEATS.length, 'ids are unique');
for (const beat of DEMO_BEATS) {
  assert.ok(beat.line.trim().length > 0, `${beat.id} has a line`);
  assert.ok(beat.ms >= 800 && beat.ms <= 10_000, `${beat.id} runs ${beat.ms}ms`);
  assert.ok(beat.card, `${beat.id} draws something`);
  if (beat.speaker) assert.ok(DEMO_SPEAKERS[beat.speaker], `${beat.id} speaker is known`);
}

// The four things the demo has to show, in the order it promises.
assert.deepEqual(
  DEMO_CHAPTERS.map((c) => c.id),
  ['task', 'groceries', 'calendar', 'trip']
);
const chapterRun: DemoChapterId[] = [];
for (const beat of DEMO_BEATS) {
  if (chapterRun[chapterRun.length - 1] !== beat.chapter) chapterRun.push(beat.chapter);
}
assert.deepEqual(chapterRun, ['task', 'groceries', 'calendar', 'trip'], 'chapters never interleave');
for (const chapter of DEMO_CHAPTERS) {
  assert.ok(
    DEMO_BEATS.some((beat) => beat.chapter === chapter.id),
    `${chapter.id} has beats`
  );
  // Each chapter ends on a result, so nothing is left hanging mid-card.
  const beats = DEMO_BEATS.filter((beat) => beat.chapter === chapter.id);
  assert.equal(beats[beats.length - 1]!.card.kind, 'done', `${chapter.id} lands`);
}

// Rose asks like you; Indigo answers as Poppins.
for (const chapter of DEMO_CHAPTERS) {
  const first = DEMO_BEATS.find((beat) => beat.chapter === chapter.id)!;
  assert.equal(first.speaker, 'rose', `${chapter.id} opens with the asking voice`);
}
assert.equal(DEMO_SPEAKERS.rose.label, 'You');
assert.equal(DEMO_SPEAKERS.indigo.label, 'Poppins');
assert.ok(DEMO_BEATS.some((beat) => beat.speaker === 'indigo'));
// Spoken lines should sound like talk, not telegraphic chips.
for (const beat of DEMO_BEATS) {
  if (!beat.speaker) continue;
  assert.ok(!/^[A-Z][a-z]+ — [A-Z]/.test(beat.line), `${beat.id} is not a label chip`);
  assert.ok(beat.line.includes(' ') || beat.line.length > 8, `${beat.id} is a spoken phrase`);
}

// The content the brief asked for is actually in the recording.
const groceries = DEMO_BEATS.find((b) => b.card.kind === 'groceries' && b.card.items.length > 2);
assert.ok(groceries, 'several groceries on one card');
const events = DEMO_BEATS.find((b) => b.card.kind === 'events' && b.card.events.length >= 3);
assert.ok(events, 'three appointments');
const trip = DEMO_BEATS.filter((b) => b.card.kind === 'trip').pop();
assert.ok(trip && trip.card.kind === 'trip' && trip.card.stops.length >= 3, 'an itinerary');
if (trip?.card.kind === 'trip') {
  for (const stop of trip.card.stops) {
    assert.ok(stop.address.trim().length > 0, `${stop.label} has an address`);
    assert.ok(stop.time.trim().length > 0, `${stop.label} has a time`);
  }
}
// The task card fills a slot at a time rather than appearing complete.
const taskCards = DEMO_BEATS.filter((b) => b.card.kind === 'task');
assert.ok(taskCards.length >= 3, 'the task fills in over several beats');
const fillCounts = taskCards.map((b) => (b.card.kind === 'task' ? b.card.filled.length : 0));
for (let i = 1; i < fillCounts.length; i += 1) {
  assert.ok(fillCounts[i]! >= fillCounts[i - 1]!, 'slots never un-fill');
}

// Nothing in the copy uses a word Poppins isn't allowed to say on screen.
for (const beat of DEMO_BEATS) {
  const text = `${beat.line} ${beat.note ?? ''}`;
  assert.ok(!/\bIUI\b|\binterface\b|\bwidget\b|\bdraft\b/i.test(text), `${beat.id} copy`);
}

// Timeline.
const total = demoTotalMs();
assert.equal(
  total,
  DEMO_BEATS.reduce((sum, b) => sum + b.ms, 0)
);
assert.ok(total > 20_000 && total < 120_000, `a demo you'll actually watch: ${total}ms`);
const offsets = demoOffsets();
assert.equal(offsets.length, DEMO_BEATS.length);
assert.equal(offsets[0], 0);
for (let i = 1; i < offsets.length; i += 1) {
  assert.equal(offsets[i], offsets[i - 1]! + DEMO_BEATS[i - 1]!.ms);
}

// Scrubbing.
assert.equal(beatAt(0), 0);
assert.equal(beatAt(-500), 0, 'before the start is the start');
assert.equal(beatAt(total + 9_999), DEMO_BEATS.length - 1, 'past the end holds the last beat');
assert.equal(beatAt(DEMO_BEATS[0]!.ms), 1, 'a beat boundary belongs to the next beat');
assert.equal(beatAt(DEMO_BEATS[0]!.ms - 1), 0);
for (let i = 0; i < DEMO_BEATS.length; i += 1) {
  assert.equal(beatAt(offsets[i]! + 1), i, `beat ${i} covers its own span`);
}

// Chapter jumps land on that chapter's first beat.
for (const chapter of DEMO_CHAPTERS) {
  const at = chapterStartMs(chapter.id);
  assert.equal(chapterOf(beatAt(at)), chapter.id, `${chapter.id} jump`);
}
assert.equal(chapterStartMs('task'), 0);
assert.equal(chapterOf(-3), DEMO_BEATS[0]!.chapter);
assert.equal(chapterOf(9_999), DEMO_BEATS[DEMO_BEATS.length - 1]!.chapter);

// Progress and clock.
assert.equal(demoProgress(0), 0);
assert.equal(demoProgress(total), 1);
assert.equal(demoProgress(total * 4), 1);
assert.equal(demoProgress(-10), 0);
assert.ok(Math.abs(demoProgress(total / 2) - 0.5) < 1e-9);
assert.equal(formatDemoClock(0), '0:00');
assert.equal(formatDemoClock(72_000), '1:12');
assert.equal(formatDemoClock(9_400), '0:09');
assert.equal(formatDemoClock(-40), '0:00');

console.log('how-it-works-script: ok');
