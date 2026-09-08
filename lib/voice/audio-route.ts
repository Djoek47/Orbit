import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/**
 * Route Poppins audio through the loudspeaker (media volume keys),
 * not the earpiece / in-call stream.
 *
 * iOS WebRTC still defaults to VoiceChat + earpiece unless the native
 * `with-webrtc-speaker` config plugin rewrites RTCAudioSessionConfiguration.
 * This JS helper covers Android, Whisper capture, and TTS; it is also
 * re-applied after WebRTC `ontrack` because the native stack can overwrite
 * the session when the peer connection starts.
 */
export async function configurePoppinsSpeakerAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.warn('[poppins-audio] speaker route failed', error);
  }
}

/** Playback through the speaker after a live session or Whisper capture ends. */
export async function restorePoppinsAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    /* ignore — session may already be torn down */
  }
}
