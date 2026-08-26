/**
 * WebRTC teardown must unbind RTCView before PeerConnection.close.
 * Closing first is the TestFlight 45 Hermes EXC_BAD_ACCESS (Object.entries / Array.map).
 * Run: npx tsx lib/voice/webrtc-teardown.test.ts
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  markVoiceNativeClosePending,
  remainingVoiceSettleMs,
  resetVoiceNativeClosePendingForTests,
  VOICE_NATIVE_CLOSE_MS,
  VOICE_TEARDOWN_SETTLE_MS,
} from './voice-lifecycle';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function source(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

const voice = source('lib/voice/poppins-voice-session.ts');
assert.match(voice, /VOICE_NATIVE_CLOSE_MS/);
assert.match(voice, /VOICE_NATIVE_SETTLE_MS/);
assert.match(voice, /teardownAllPoppinsVoiceAndSettle/);
assert.match(voice, /onRemoteStream\?\.\(null\)/);
const disconnect = voice.slice(voice.indexOf('disconnect() {'));
const unbindAt = disconnect.indexOf('onRemoteStream?.(null)');
const timerAt = disconnect.indexOf('setTimeout');
assert.ok(unbindAt >= 0, 'unbind RTCView');
assert.ok(timerAt > unbindAt, 'native close is deferred after unbind');
assert.match(disconnect, /pc\.close\(\)/);
assert.match(disconnect, /signalingState/);

const reset = source('lib/navigation/reset-to-get-started.ts');
assert.match(reset, /teardownAllPoppinsVoice\(\)/);
assert.match(reset, /scheduleSignedOutRestart/, 'sign-out remount is deferred');
assert.equal(reset.includes('VOICE_NATIVE_CLOSE_MS + 40'), false, 'IPA 49 160ms remount is gone');

const stage = source('components/orbit/poppins-stage.tsx');
assert.ok(!stage.includes('exiting={FadeOut'), 'live IUI must not FadeOut the stage under WebRTC');
assert.match(stage, /writesRef/, 'HOLD commit handler must not reset when tasks update');

const chips = source('components/orbit/poppins-stage/iui-chips.tsx');
assert.ok(!chips.includes('entering={FadeIn'), 'chore chips must not mount-animate under WebRTC');

const stageDir = join(root, 'components/orbit/poppins-stage');
for (const file of readdirSync(stageDir)) {
  if (!file.endsWith('.tsx')) continue;
  const src = source(`components/orbit/poppins-stage/${file}`);
  assert.equal(src.includes('entering='), false, `${file} must not mount-animate under live WebRTC`);
}

assert.equal(voice.includes('new FormData'), false, 'SDP must be JSON — FormData hits RCTBlobManager on iOS 27');
assert.equal(voice.includes("form.append('sdp'"), false);
assert.match(voice, /Content-Type': 'application\/json'/);
assert.match(voice, /Realtime SDP failed/);
assert.match(voice, /empty body/);
assert.match(voice, /\[poppins-voice\] sdp error/);

const sdpFn = source('supabase/functions/poppins-realtime-sdp/index.ts');
assert.match(sdpFn, /text\/plain/);
assert.equal(sdpFn.includes("'Content-Type': 'application/sdp'"), false);

const restart = source('lib/navigation/session-restart.ts');
assert.match(restart, /SESSION_NAV_DELAY_MS = 400/);
assert.match(restart, /cancelSignedOutRestart/);
const sched = restart.slice(restart.indexOf('export function scheduleSignedOutRestart'));
assert.equal(
  sched.includes('remountSignedOutSession'),
  false,
  'sign-out must not remount Stack — IPA 50 login crash 08497FBD',
);

const signOut = source('lib/auth/local-sign-out.ts');
assert.match(signOut, /teardownAllPoppinsVoiceAndSettle/);

const layout = source('app/_layout.tsx');
assert.match(layout, /LayoutAnimationConfig/);
assert.equal(layout.includes('<OrbitProvider key={sessionEpoch}>'), false);

const appJson = source('app.json');
assert.match(appJson, /ON_ERROR_RECOVERY/, 'OTA must not fetch on every Speak launch');
assert.match(appJson, /fallbackToCacheTimeout/);

const connectFn = voice.slice(voice.indexOf('async connect('));
const settleAt = connectFn.indexOf('await teardownAllPoppinsVoiceAndSettle(this)');
const gumAt = connectFn.indexOf('getUserMedia');
assert.ok(settleAt >= 0, 'connect waits for native settle');
assert.ok(gumAt > settleAt, 'no second getUserMedia until close settle');
assert.equal(
  connectFn.includes('takeWarmedMicrophone()'),
  false,
  'connect must mint a fresh mic after settle — warmed tracks may already be stopped'
);
assert.match(voice, /beginVoiceAudioEpoch/);
assert.match(voice, /currentVoiceAudioEpoch\(\) === closeEpoch/);

const poppinsTab = source('app/(tabs)/poppins.tsx');
assert.match(poppinsTab, /voiceSettling/);
assert.match(poppinsTab, /await voiceRef\.current\?\.end\('manual'\)/);
assert.match(poppinsTab, /disabled=\{voiceSettling\}/);
assert.equal(
  poppinsTab.includes('warmPoppinsMicrophone()'),
  false,
  'Speak must not warm the mic before native settle'
);
assert.match(poppinsTab, /await waitForPendingVoiceNativeSettle\(\)/);

resetVoiceNativeClosePendingForTests();
assert.equal(remainingVoiceSettleMs(), 0);
markVoiceNativeClosePending();
const remaining = remainingVoiceSettleMs();
assert.ok(remaining > VOICE_NATIVE_CLOSE_MS, 'reconnect waits past native close');
assert.ok(remaining <= VOICE_TEARDOWN_SETTLE_MS);
resetVoiceNativeClosePendingForTests();
assert.equal(remainingVoiceSettleMs(), 0);

console.log('PASS webrtc-teardown');
