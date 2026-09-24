/**
 * Speak control transport — Quiet (batch Whisper) vs Speak back (Realtime).
 * WO15 §1.1: gate the mic by transport, never by WebRTC alone.
 */

import { loadExpoAudio } from '@/lib/voice/mic-capture';
import { isPoppinsNativeVoiceAvailable } from '@/lib/voice/poppins-voice-session';

export type SpeakTransport = 'quiet' | 'realtime';

export function speakTransportForPrefs(speakBack: boolean): SpeakTransport {
  return speakBack ? 'realtime' : 'quiet';
}

/** Quiet path must never construct a Realtime voice session. */
export function usesPoppinsVoiceSession(transport: SpeakTransport): boolean {
  return transport === 'realtime';
}

/** Base / Quiet needs only expo-audio. */
export function quietCaptureAvailable(): boolean {
  return loadExpoAudio() != null;
}

/** Max / Speak back needs the WebRTC native module + flag. */
export function realtimeCaptureAvailable(): boolean {
  return isPoppinsNativeVoiceAvailable();
}

export type MicUiKind =
  | 'quiet_ready'
  | 'realtime_ready'
  | 'realtime_needs_build'
  | 'keyboard_only';

export type MicUiState = {
  kind: MicUiKind;
  micEnabled: boolean;
  preferKeyboard: boolean;
  hint?: string;
  offerSwitchToBase?: boolean;
};

export type MicAvailability = {
  quiet?: boolean;
  realtime?: boolean;
};

/**
 * Decide what the dock mic should look like for the current Speak-back pref.
 * Never returns an empty mic slot.
 */
export function micUiForPrefs(
  speakBack: boolean,
  availability: MicAvailability = {}
): MicUiState {
  const quietOk = availability.quiet ?? quietCaptureAvailable();
  const realtimeOk = availability.realtime ?? realtimeCaptureAvailable();
  const transport = speakTransportForPrefs(speakBack);

  if (transport === 'quiet') {
    if (quietOk) {
      return { kind: 'quiet_ready', micEnabled: true, preferKeyboard: false };
    }
    return {
      kind: 'keyboard_only',
      micEnabled: false,
      preferKeyboard: true,
      hint: 'Voice capture is unavailable in this build — type instead.',
    };
  }

  if (realtimeOk) {
    return { kind: 'realtime_ready', micEnabled: true, preferKeyboard: false };
  }

  if (quietOk) {
    return {
      kind: 'realtime_needs_build',
      micEnabled: false,
      preferKeyboard: false,
      hint: 'Speak back needs a full build — switch to Base to talk now',
      offerSwitchToBase: true,
    };
  }

  return {
    kind: 'keyboard_only',
    micEnabled: false,
    preferKeyboard: true,
    hint: 'Voice needs a full build with WebRTC — type instead.',
  };
}
