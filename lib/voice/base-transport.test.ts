/**
 * WO15 §5 — Base mic UI gates by transport, not WebRTC.
 * Run: npx --yes tsx lib/voice/base-transport.test.ts
 */
import assert from 'node:assert/strict';

import {
  micUiForPrefs,
  speakTransportForPrefs,
  usesPoppinsVoiceSession,
} from '@/lib/voice/speak-transport';

{
  const base = micUiForPrefs(false, { quiet: true, realtime: false });
  assert.equal(base.kind, 'quiet_ready');
  assert.equal(base.micEnabled, true);
  assert.equal(base.preferKeyboard, false);
}

{
  const max = micUiForPrefs(true, { quiet: true, realtime: false });
  assert.equal(max.kind, 'realtime_needs_build');
  assert.equal(max.micEnabled, false);
  assert.equal(max.offerSwitchToBase, true);
  assert.match(max.hint ?? '', /switch to Base/i);
}

{
  const none = micUiForPrefs(false, { quiet: false, realtime: false });
  assert.equal(none.kind, 'keyboard_only');
  assert.equal(none.preferKeyboard, true);
  assert.equal(none.micEnabled, false);
}

{
  assert.equal(usesPoppinsVoiceSession(speakTransportForPrefs(false)), false);
  assert.equal(usesPoppinsVoiceSession(speakTransportForPrefs(true)), true);
}

console.log('PASS base-transport');
