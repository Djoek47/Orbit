/**
 * Native WebRTC speaker patch still matches react-native-webrtc 124.
 * Run: npx --yes tsx lib/voice/webrtc-speaker-plugin.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { patchAndroidWebRtcModule, patchIosWebRtcModule } = require('../../plugins/with-webrtc-speaker.js') as {
  patchAndroidWebRtcModule: (src: string) => string;
  patchIosWebRtcModule: (src: string) => string;
};

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MARKER = 'Choremaxx: Poppins speaker (media volume, not in-call earpiece)';

const iosSrc = readFileSync(
  join(root, 'node_modules/react-native-webrtc/ios/RCTWebRTC/WebRTCModule.m'),
  'utf8'
);
const androidSrc = readFileSync(
  join(
    root,
    'node_modules/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule/WebRTCModule.java'
  ),
  'utf8'
);

const iosPatched = patchIosWebRtcModule(iosSrc);
assert.ok(iosPatched.includes(MARKER), 'iOS patch inserts speaker marker');
assert.ok(iosPatched.includes('AVAudioSessionCategoryOptionDefaultToSpeaker'));
assert.ok(iosPatched.includes('AVAudioSessionModeDefault'));
assert.equal(patchIosWebRtcModule(iosPatched), iosPatched, 'iOS patch is idempotent');

const androidPatched = patchAndroidWebRtcModule(androidSrc);
assert.ok(androidPatched.includes(MARKER), 'Android patch inserts speaker marker');
assert.ok(androidPatched.includes('setSpeakerphoneOn(true)'));
assert.ok(androidPatched.includes('MODE_NORMAL'));
assert.equal(patchAndroidWebRtcModule(androidPatched), androidPatched, 'Android patch is idempotent');

console.log('with-webrtc-speaker plugin: ok');
