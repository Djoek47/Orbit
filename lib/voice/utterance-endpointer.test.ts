import assert from 'node:assert/strict';

import { createEndpointer, endsOnGlue } from '@/lib/voice/utterance-endpointer';

// A: a sentence ends after a pause, and only new words come out.
{
  const e = createEndpointer({ silenceMs: 1000, hangMs: 2000 });
  assert.equal(e.feed('add milk', false, 0).live, 'add milk');
  assert.equal(e.feed('add milk and eggs', false, 300).live, 'add milk and eggs');
  assert.equal(e.tick(900).utterance, undefined);
  assert.equal(e.tick(1400).utterance, 'add milk and eggs');
  // The recognizer keeps the whole session's transcript; only the new part is emitted.
  e.feed('add milk and eggs clean the dishes for Mia', false, 3000);
  assert.equal(e.tick(3500).live, 'clean the dishes for Mia');
  assert.equal(e.tick(4100).utterance, 'clean the dishes for Mia');
}

// B: glue at the end waits longer — "clean the dishes for …" is not a sentence yet.
{
  const e = createEndpointer({ silenceMs: 1000, hangMs: 2500 });
  e.feed('clean the dishes for', false, 0);
  assert.equal(e.tick(1200).utterance, undefined);
  e.feed('clean the dishes for Mia', false, 1800);
  assert.equal(e.tick(2900).utterance, 'clean the dishes for Mia');
}

// C: a native final ends at once.
{
  const e = createEndpointer();
  const out = e.feed('dentist next thursday at half four', true, 10);
  assert.equal(out.utterance, 'dentist next thursday at half four');
  assert.equal(e.tick(5000).utterance, undefined);
}

// D: revisions inside an emitted sentence never re-emit it; restart starts clean.
{
  const e = createEndpointer({ silenceMs: 500 });
  e.feed('add bread', false, 0);
  assert.equal(e.tick(600).utterance, 'add bread');
  e.feed('add brad', false, 700); // recognizer second-guesses an old word
  assert.equal(e.tick(1400).utterance, undefined);
  e.reset();
  e.feed('and jam', false, 2000);
  assert.equal(e.tick(2600).utterance, 'and jam');
}

// E: flush hands back a half sentence when the person taps to close.
{
  const e = createEndpointer();
  e.feed('pick up the kids at', false, 0);
  assert.equal(e.flush(), 'pick up the kids at');
  assert.equal(e.flush(), undefined);
}

assert.equal(endsOnGlue('milk and'), true);
assert.equal(endsOnGlue('milk'), false);
assert.equal(endsOnGlue('dentiste pour'), true);

console.log('utterance-endpointer: ok');
