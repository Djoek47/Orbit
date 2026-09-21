/**
 * Quiet must not send a sentence the user never said.
 * Run: npx tsx lib/voice/quiet-transcript.test.ts
 */
import assert from 'node:assert/strict';

import { acceptQuietTranscript } from '@/lib/voice/quiet-transcript';

assert.equal(acceptQuietTranscript(null), null);
assert.equal(acceptQuietTranscript(''), null);
assert.equal(acceptQuietTranscript('  a '), null);
assert.equal(acceptQuietTranscript('you'), null);
assert.equal(acceptQuietTranscript('Thank you.'), null);
assert.equal(acceptQuietTranscript('Thanks for watching'), null);
assert.equal(acceptQuietTranscript('Bye!'), null);
assert.equal(acceptQuietTranscript('add milk'), 'add milk');

console.log('quiet-transcript.test.ts ok');
