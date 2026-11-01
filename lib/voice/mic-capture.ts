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

/** The microphone is held by something else (a call, Siri, another app's audio). */
export class MicBusyError extends Error {
  constructor(public readonly detail: string) {
    super(MIC_BUSY_MESSAGE);
    this.name = 'MicBusyError';
  }
}

export const MIC_BUSY_MESSAGE =
  "The microphone is busy — a call or another app may be using it. Tap Speak to try again.";

/**
 * iOS refuses to start recording when the audio session can't take over — OSStatus
 * 560557684 ('!int', can't interrupt others) or 561017449 ('!pri', insufficient priority),
 * typically while a call, Siri, or the last reply's audio still holds it.
 */
function isAudioSessionRefusal(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /560557684|561017449|560030580|audio session|AudioRecordingException|prepareToRecord/i.test(text);
}

export async function startMicRecorder(metering: boolean): Promise<AudioRecorder> {
  const audio = loadExpoAudio();
  if (!audio) throw new Error(micUnavailableMessage());
  const attempt = async () => {
    const recorder = new audio.AudioModule.AudioRecorder({
      ...audio.RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: metering,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return recorder;
  };
  try {
    return await attempt();
  } catch (first) {
    if (!isAudioSessionRefusal(first)) throw first;
    // Let whatever held the session let go, then ask for it without interrupting anyone.
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      await audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
        shouldRouteThroughEarpiece: false,
      });
      return await attempt();
    } catch (second) {
      throw new MicBusyError(second instanceof Error ? second.message : String(second));
    }
  }
}

/** Words for a person when listening couldn't start — never the native exception text. */
export function friendlyMicError(error: unknown, fallback = "Couldn't start listening. Tap Speak to try again."): string {
  if (error instanceof MicBusyError) return error.message;
  if (isAudioSessionRefusal(error)) return MIC_BUSY_MESSAGE;
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (text === micUnavailableMessage()) return text;
  if (/permission|not allowed|denied/i.test(text)) return 'Poppins needs the microphone — allow it in Settings.';
  // Native / internal messages (FunctionCallException, OSStatus, stack paths) are for the log.
  if (/exception|osstatus|\.swift|\.m:|error domain|code=|\{|\}/i.test(text) || text.length > 140) return fallback;
  return text || fallback;
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
