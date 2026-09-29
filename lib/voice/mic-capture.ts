/**
 * Microphone capture on Expo SDK 57.
 * `expo-av` does not compile against ExpoModulesCore on Xcode 26, so Quiet
 * and Whisper use `expo-audio`. Load it lazily so a missing native module
 * does not take down the rest of the app.
 */

import type { AudioRecorder } from 'expo-audio';

type ExpoAudioModule = typeof import('expo-audio');

let cached: ExpoAudioModule | null | undefined;

export function loadExpoAudio(): ExpoAudioModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-audio') as ExpoAudioModule;
  } catch (error) {
    console.warn('[expo-audio] unavailable in this runtime', error);
    cached = null;
  }
  return cached;
}

export function micUnavailableMessage(): string {
  return 'Voice capture is unavailable in this build.';
}

export async function micPermissionGranted(): Promise<boolean> {
  const audio = loadExpoAudio();
  if (!audio) return false;
  try {
    const perm = await audio.getRecordingPermissionsAsync();
    return perm.granted;
  } catch {
    return false;
  }
}

export async function requestMicPermission(): Promise<boolean> {
  const audio = loadExpoAudio();
  if (!audio) return false;
  const perm = await audio.requestRecordingPermissionsAsync();
  return perm.granted;
}

export async function startMicRecorder(metering: boolean): Promise<AudioRecorder> {
  const audio = loadExpoAudio();
  if (!audio) throw new Error(micUnavailableMessage());
  const recorder = new audio.AudioModule.AudioRecorder({
    ...audio.RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: metering,
  });
  await recorder.prepareToRecordAsync();
  recorder.record();
  return recorder;
}

export async function finishMicRecorder(recorder: AudioRecorder): Promise<string | null> {
  try {
    if (recorder.getStatus().isRecording || recorder.isRecording) {
      await recorder.stop();
    }
  } catch {
    try {
      await recorder.stop();
    } catch {
      return recorder.uri;
    }
  }
  return recorder.uri ?? recorder.getStatus().url;
}
