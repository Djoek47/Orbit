/**
 * Speak control transport — Quiet (batch Whisper) vs Speak back (Realtime).
 * Pure branch so tests can prove Speak back off never needs PoppinsVoiceSession.
 */

export type SpeakTransport = 'quiet' | 'realtime';

export function speakTransportForPrefs(speakBack: boolean): SpeakTransport {
  return speakBack ? 'realtime' : 'quiet';
}

/** Quiet path must never construct a Realtime voice session. */
export function usesPoppinsVoiceSession(transport: SpeakTransport): boolean {
  return transport === 'realtime';
}
