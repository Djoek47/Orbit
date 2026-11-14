import assert from 'node:assert/strict';

import {
  isWeakTranscript,
  looksNonEnglish,
  shouldEscalateAppleTranscript,
} from '@/lib/voice/listen-quality';
import {
  appleEndedPrefersCloud,
  appleFailurePrefersCloud,
  resolveAppleFailure,
  resolveAppleUtterance,
} from '@/lib/voice/base-listen-hybrid';

assert.equal(looksNonEnglish('add milk to the list'), false);
assert.equal(looksNonEnglish('Une tâche pour Mia demain'), true);
assert.equal(looksNonEnglish('Bonjour est-ce que tu peux rajouter du lait'), true);
assert.equal(looksNonEnglish('dentist Thursday at four'), false);

assert.equal(isWeakTranscript(''), true);
assert.equal(isWeakTranscript('um'), true);
assert.equal(isWeakTranscript('add eggs'), false);

assert.equal(shouldEscalateAppleTranscript('Une tâche pour demain'), 'non_english');
assert.equal(shouldEscalateAppleTranscript('uh'), 'weak');
assert.equal(shouldEscalateAppleTranscript('take out the trash'), null);

assert.equal(appleFailurePrefersCloud('language'), true);
assert.equal(appleFailurePrefersCloud('permission'), false);
assert.equal(appleEndedPrefersCloud('silent_start'), true);
assert.equal(appleEndedPrefersCloud('idle'), false);

assert.deepEqual(resolveAppleUtterance('add milk', false), {
  action: 'use_text',
  text: 'add milk',
});
assert.deepEqual(resolveAppleUtterance('Une tâche pour Mia', false), {
  action: 'cloud',
  reason: 'non_english',
});
assert.deepEqual(resolveAppleUtterance('add milk', true), {
  action: 'cloud',
  reason: 'prefer',
});

assert.deepEqual(resolveAppleFailure('language', true), {
  action: 'cloud',
  reason: 'failure',
});
assert.deepEqual(resolveAppleFailure('permission', true), {
  action: 'trouble',
  reason: 'permission',
});
assert.deepEqual(resolveAppleFailure('network', false), {
  action: 'trouble',
  reason: 'network',
});

console.log('listen-quality: ok');
