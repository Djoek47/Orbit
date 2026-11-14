import assert from 'node:assert/strict';

import {
  applyLiveCaptionTurn,
  captionWindow,
  LIVE_CAPTION_DISPLAY_MAX,
  LIVE_CAPTION_STORE_MAX,
  mergeTranscript,
} from './transcript-merge';

assert.equal(mergeTranscript('', 'Hello'), 'Hello');
assert.equal(mergeTranscript('Hel', 'Hello'), 'Hello');
assert.equal(mergeTranscript('Hello there', 'Hello'), 'Hello there');
assert.equal(mergeTranscript('Hello', 'Hello world'), 'Hello world');
assert.equal(mergeTranscript('Hi', 'Bye'), 'Bye');

assert.equal(captionWindow('Short line'), 'Short line');
assert.equal(captionWindow('  extra   spaces  '), 'extra spaces');

const long = `${'word '.repeat(80)}Final sentence about laundry on Friday.`;
const windowed = captionWindow(long);
assert.ok(windowed.startsWith('…'));
assert.ok(windowed.length <= LIVE_CAPTION_DISPLAY_MAX + 1);
assert.ok(windowed.includes('laundry on Friday'));

const stored = captionWindow(long, LIVE_CAPTION_STORE_MAX);
assert.ok(stored.length <= LIVE_CAPTION_STORE_MAX + 1);

const you = applyLiveCaptionTurn(null, 'you', "Okay, I'll assign laundry to me on Friday.");
assert.equal(you.speaker, 'you');
assert.ok(you.text.includes('laundry'));

const swapped = applyLiveCaptionTurn(
  you,
  'poppins',
  "I've drafted Laundry for you, due Friday, with the details prefilled."
);
assert.equal(swapped.speaker, 'poppins');
assert.equal(swapped.text.includes('Okay'), false);
assert.ok(swapped.text.includes('Laundry'));

const continued = applyLiveCaptionTurn(swapped, 'poppins', `${swapped.text} Please review it.`);
assert.equal(continued.speaker, 'poppins');
assert.ok(continued.text.includes('Please review'));

const nextYou = applyLiveCaptionTurn(continued, 'you', '', true);
assert.deepEqual(nextYou, { speaker: 'you', text: '' });

const huge = applyLiveCaptionTurn(null, 'poppins', 'alpha '.repeat(120));
assert.ok(huge.text.length <= LIVE_CAPTION_STORE_MAX + 1);

console.log('transcript-merge: ok');
