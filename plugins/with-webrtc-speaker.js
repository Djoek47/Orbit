/**
 * Force Poppins WebRTC onto the loudspeaker with media-like volume keys.
 *
 * react-native-webrtc defaults iOS to PlayAndRecord + VoiceChat (earpiece,
 * in-call volume) and Android to MODE_IN_COMMUNICATION. That sounds like a
 * quiet phone call. We rewrite the native audio session to DefaultToSpeaker
 * + AVAudioSessionModeDefault (iOS) and MODE_NORMAL + speakerphone (Android).
 *
 * Requires a native EAS rebuild — OTA cannot change this.
 */
const { createRunOncePlugin, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG = 'with-webrtc-speaker';
const MARKER = 'Choremaxx: Poppins speaker (media volume, not in-call earpiece)';

const IOS_SNIPPET = `
        // ${MARKER}
        RTCAudioSessionConfiguration *poppinsAudio = [RTCAudioSessionConfiguration webRTCConfiguration];
        poppinsAudio.category = AVAudioSessionCategoryPlayAndRecord;
        poppinsAudio.categoryOptions =
            AVAudioSessionCategoryOptionDefaultToSpeaker |
            AVAudioSessionCategoryOptionAllowBluetooth |
            AVAudioSessionCategoryOptionAllowBluetoothA2DP |
            AVAudioSessionCategoryOptionMixWithOthers;
        poppinsAudio.mode = AVAudioSessionModeDefault;
        [RTCAudioSessionConfiguration setWebRTCConfiguration:poppinsAudio];
`;

const ANDROID_ADM_SNIPPET = `
        // ${MARKER}
        try {
            android.media.AudioManager am =
                (android.media.AudioManager) reactContext.getSystemService(android.content.Context.AUDIO_SERVICE);
            if (am != null) {
                am.setMode(android.media.AudioManager.MODE_NORMAL);
                am.setSpeakerphoneOn(true);
            }
        } catch (Exception ignored) {
        }
`;

function patchIosWebRtcModule(src) {
  if (src.includes(MARKER)) return src;
  const needle = '        _decoderFactory = decoderFactory;';
  if (!src.includes(needle)) {
    throw new Error(
      `${TAG}: could not find WebRTCModule.m insertion point. react-native-webrtc may have changed.`
    );
  }
  return src.replace(needle, `${needle}\n${IOS_SNIPPET}`);
}

function patchAndroidWebRtcModule(src) {
  if (src.includes(MARKER)) return src;
  const needle =
    '            adm = JavaAudioDeviceModule.builder(reactContext).setEnableVolumeLogger(false).createAudioDeviceModule();';
  if (!src.includes(needle)) {
    throw new Error(
      `${TAG}: could not find WebRTCModule.java ADM insertion point. react-native-webrtc may have changed.`
    );
  }
  return src.replace(needle, `${needle}\n${ANDROID_ADM_SNIPPET}`);
}

function withWebrtcSpeaker(config) {
  config = withDangerousMod(config, [
    'ios',
    async (mod) => {
      const file = path.join(
        mod.modRequest.projectRoot,
        'node_modules/react-native-webrtc/ios/RCTWebRTC/WebRTCModule.m'
      );
      if (!fs.existsSync(file)) {
        throw new Error(`${TAG}: missing ${file}`);
      }
      const next = patchIosWebRtcModule(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, next);
      return mod;
    },
  ]);

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const file = path.join(
        mod.modRequest.projectRoot,
        'node_modules/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule/WebRTCModule.java'
      );
      if (!fs.existsSync(file)) {
        throw new Error(`${TAG}: missing ${file}`);
      }
      const next = patchAndroidWebRtcModule(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, next);
      return mod;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withWebrtcSpeaker, TAG, '1.0.0');
module.exports.patchIosWebRtcModule = patchIosWebRtcModule;
module.exports.patchAndroidWebRtcModule = patchAndroidWebRtcModule;
