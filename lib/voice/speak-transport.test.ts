/**
 * Quiet Speak must never construct PoppinsVoiceSession.
 * Run: npx --yes tsx lib/voice/speak-transport.test.ts
 */
import assert from 'node:assert/strict';

import {
  speakTransportForPrefs,
  usesPoppinsVoiceSession,
} from '@/lib/voice/speak-transport';

assert.equal(speakTransportForPrefs(false), 'quiet');
assert.equal(speakTransportForPrefs(true), 'realtime');
assert.equal(usesPoppinsVoiceSession('quiet'), false);
assert.equal(usesPoppinsVoiceSession('realtime'), true);

// Document the invariant: Speak with Speak back off never needs Realtime.
assert.equal(
  usesPoppinsVoiceSession(speakTransportForPrefs(false)),
  false,
  'Speak back off must never construct PoppinsVoiceSession'
);

console.log('PASS speak-transport');
