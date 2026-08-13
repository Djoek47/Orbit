import assert from 'node:assert/strict';

import { mergeTranscript } from './transcript-merge';

assert.equal(mergeTranscript('', 'Hello'), 'Hello');
assert.equal(mergeTranscript('Hel', 'Hello'), 'Hello');
assert.equal(mergeTranscript('Hello there', 'Hello'), 'Hello there');
assert.equal(mergeTranscript('Hello', 'Hello world'), 'Hello world');
assert.equal(mergeTranscript('Hi', 'Bye'), 'Bye');

console.log('transcript-merge: ok');
