import assert from 'node:assert/strict';

import {
  photoBeats,
  walkthroughBeats,
  walkthroughProgress,
} from '@/lib/tour/proof-walkthrough';

// A chore walkthrough goes all the way round the loop, twice past the camera.
const chore = walkthroughBeats('chore', 'Mia');
assert.deepEqual(
  chore.map((b) => b.id),
  ['assigned', 'completed', 'ask', 'photo-1', 'reject', 'photo-2', 'confirm']
);

// The first photo is refused, the second accepted — that contrast is the lesson.
assert.deepEqual(photoBeats(chore).map((b) => b.verdict), ['messy', 'clean']);

// The phone changes hands at the right moments.
assert.deepEqual(
  chore.map((b) => b.actor),
  ['admin', 'sidekick', 'admin', 'sidekick', 'admin', 'sidekick', 'admin']
);

// The child's name is used, never left as a placeholder.
for (const beat of chore) {
  assert.ok(!beat.body.includes('{kid}'), `unfilled name in ${beat.id}`);
  assert.ok(!beat.cta.includes('{kid}'), `unfilled name in ${beat.id} cta`);
}
assert.ok(chore[0]!.cta.includes('Mia'));

// No name given still reads as a sentence.
assert.ok(walkthroughBeats('chore', '  ')[0]!.cta.includes('your Sidekick'));

// Homework tells the same story in its own words.
const homework = walkthroughBeats('homework', 'Noah');
assert.deepEqual(homework.map((b) => b.id), chore.map((b) => b.id));
assert.match(homework[3]!.body, /blank/);

// A plan event is the approval story, not the photo one.
const plan = walkthroughBeats('plan', 'Mia');
assert.deepEqual(plan.map((b) => b.id), ['plan-added', 'plan-waiting', 'plan-done']);
assert.equal(photoBeats(plan).length, 0);

// Progress runs 0 → 1 across the beats.
assert.equal(walkthroughProgress(chore, 0), 0);
assert.equal(walkthroughProgress(chore, chore.length - 1), 1);
assert.ok(walkthroughProgress(chore, 3) > 0 && walkthroughProgress(chore, 3) < 1);

console.log('proof-walkthrough: ok');
