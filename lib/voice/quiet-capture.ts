/**
 * Quiet (Speak back off) voice capture — batch Whisper only.
 * WO15 §3: hold-to-talk. Metering drives the waveform only — never gates send.
 * Never opens a Realtime / PoppinsVoiceSession.
 */

import type { AudioRecorder } from 'expo-audio';

import { configurePoppinsSpeakerAudio, restorePoppinsAudio } from '@/lib/voice/audio-route';
import {
  finishMicRecorder,
  micUnavailableMessage,
  requestMicPermission,
  startMicRecorder,
} from '@/lib/voice/mic-capture';
import { transcribeQuietAudio } from '@/lib/voice/poppins-voice';
import { POPPINS_PAUSED_COPY } from '@/lib/ai/credits';
import {
  classifyVoiceFailure,
  persistVoiceFailure,
  VoiceFailureError,
  type VoiceFailureCause,
} from '@/lib/voice/quiet-failures';
import { acceptQuietTranscript } from '@/lib/voice/quiet-transcript';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const HARD_CAP_MS = 30_000;
const POLL_MS = 100;
/** Min recording length before we bother Whisper (WO15 §3). */
const MIN_WHISPER_MS = 700;
/** Fake waveform when metering is absent. */
const WAVEFORM_FALLBACK_DB = -28;

export type QuietStopFailure = {
  failed: 'no_audio' | 'too_short' | 'transcribe_failed' | 'empty_transcript' | VoiceFailureCause;
  detail?: string;
};

export type QuietStopResult = { transcript: string } | QuietStopFailure;

export type QuietCapture = {
  start(opts: {
    onPartial?: (text: string) => void;
    onLevel?: (db: number) => void;
    onStatus?: (status: 'listening' | 'transcribing' | 'got_it') => void;
    /** Fired at the 30s hard cap. Caller should `stop()`. */
    onAutoStop?: () => void;
    /** Seconds remaining when countdown should show (≤5). */
    onCapCountdown?: (secondsLeft: number) => void;
  }): Promise<void>;
  stop(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<QuietStopResult>;
  cancel(): Promise<void>;
  readonly streaming: boolean;
  readonly active: boolean;
  /** Elapsed ms since start (for UI). */
  readonly elapsedMs: number;
};

export const QUIET_FAILURE_MESSAGES: Record<string, string> = {
  no_audio: "The microphone didn't record anything. Check microphone access in iOS Settings.",
  too_short: 'Hold while you speak',
  transcribe_failed: "I couldn't reach the transcriber.",
  empty_transcript: "I didn't hear words. Hold while you speak, then let go.",
  ai_off: 'Poppins AI is off in this build.',
  signed_out: "You're signed out — sign in to use Poppins.",
  whisper_failed: "I couldn't reach the transcriber.",
  budget_tripped: POPPINS_PAUSED_COPY,
};

/**
 * Batch Quiet capture via expo-audio → Whisper (`transcriptOnly`).
 * Hold-to-talk: no silence auto-stop. Metering is waveform-only.
 */
export function createQuietCapture(): QuietCapture {
  let recording: AudioRecorder | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
  let startedAt = 0;
  let active = false;
  let finishing: Promise<QuietStopResult> | null = null;
  let onLevel: ((db: number) => void) | undefined;
  let onStatus: ((status: 'listening' | 'transcribing' | 'got_it') => void) | undefined;
  let onPartial: ((text: string) => void) | undefined;
  let onAutoStop: (() => void) | undefined;
  let onCapCountdown: ((secondsLeft: number) => void) | undefined;
  let autoStoppedUri: string | null | undefined;
  let autoStopWaiters: Array<(uri: string | null) => void> = [];
  let stopRequested = false;
  let pollCount = 0;
  let meteringSeen = false;
  let lastCountdownSec = -1;

  const clearTimers = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (hardCapTimer) {
      clearTimeout(hardCapTimer);
      hardCapTimer = null;
    }
  };

  const finishRecording = async (): Promise<string | null> => {
    clearTimers();
    const current = recording;
    recording = null;
    if (!current) return autoStoppedUri ?? null;
    try {
      const uri = await finishMicRecorder(current);
      await restorePoppinsAudio();
      return uri;
    } catch {
      await restorePoppinsAudio().catch(() => undefined);
      return null;
    }
  };

  const signalAutoStop = (uri: string | null) => {
    autoStoppedUri = uri;
    const waiters = autoStopWaiters;
    autoStopWaiters = [];
    for (const resolve of waiters) resolve(uri);
  };

  const requestAutoStop = async () => {
    if (stopRequested || !active || recording == null) return;
    const uri = await finishRecording();
    signalAutoStop(uri);
    const cb = onAutoStop;
    onAutoStop = undefined;
    cb?.();
  };

  const api: QuietCapture = {
    get streaming() {
      return false;
    },
    get active() {
      return active;
    },
    get elapsedMs() {
      return active ? Date.now() - startedAt : 0;
    },

    async start(opts) {
      if (active) return;
      onLevel = opts.onLevel;
      onStatus = opts.onStatus;
      onPartial = opts.onPartial;
      onAutoStop = opts.onAutoStop;
      onCapCountdown = opts.onCapCountdown;
      startedAt = Date.now();
      active = true;
      finishing = null;
      stopRequested = false;
      autoStoppedUri = undefined;
      pollCount = 0;
      meteringSeen = false;
      lastCountdownSec = -1;
      onStatus?.('listening');
      onPartial?.('Listening…');

      const allowed = await requestMicPermission();
      if (!allowed) {
        active = false;
        throw new Error(micUnavailableMessage());
      }

      await configurePoppinsSpeakerAudio();
      // Metering preferred for waveform; if absent we animate on a timer.
      const next = await startMicRecorder(true);
      recording = next;

      pollTimer = setInterval(() => {
        void (async () => {
          if (!recording || !active) return;
          try {
            const status = recording.getStatus();
            if (!status.isRecording) return;
            pollCount += 1;
            const hasMetering = typeof status.metering === 'number';
            if (hasMetering) {
              meteringSeen = true;
              onLevel?.(status.metering!);
            } else {
              // Waveform fallback — never gates send (WO15 §3).
              const pulse = WAVEFORM_FALLBACK_DB + Math.sin(pollCount / 3) * 8;
              onLevel?.(pulse);
            }

            // Countdown appears from 25s elapsed / last 5s (WO15 §3).
            const elapsed = Date.now() - startedAt;
            const left = Math.ceil((HARD_CAP_MS - elapsed) / 1000);
            if (left <= 5 && left !== lastCountdownSec) {
              lastCountdownSec = left;
              onCapCountdown?.(Math.max(0, left));
            }
          } catch {
            /* ignore metering blips */
          }
        })();
      }, POLL_MS);

      hardCapTimer = setTimeout(() => {
        void requestAutoStop();
      }, HARD_CAP_MS);
    },

    async stop(household, metrics) {
      if (finishing) return finishing;
      stopRequested = true;
      finishing = (async (): Promise<QuietStopResult> => {
        onStatus?.('got_it');
        onPartial?.('Got it');
        onStatus?.('transcribing');

        const durationMillis = Date.now() - startedAt;

        let uri: string | null;
        if (autoStoppedUri !== undefined) {
          uri = autoStoppedUri;
        } else if (recording) {
          uri = await finishRecording();
        } else {
          uri = await new Promise<string | null>((resolve) => {
            autoStopWaiters.push(resolve);
            setTimeout(() => resolve(null), 50);
          });
        }

        active = false;

        if (!uri) {
          const result: QuietStopFailure = { failed: 'no_audio' };
          // Mic issue — not one of the four voice: causes; do not mislabel as whisper.
          return result;
        }

        if (durationMillis < MIN_WHISPER_MS) {
          const result: QuietStopFailure = {
            failed: 'too_short',
            detail: `durationMs=${durationMillis}`,
          };
          // Tip only — not an error card / last-error (WO15 §3).
          return result;
        }

        try {
          const transcript = await transcribeQuietAudio(uri, household, metrics);
          const accepted = acceptQuietTranscript(transcript);
          if (!accepted) {
            const result: QuietStopFailure = {
              failed: 'empty_transcript',
              detail: transcript ? `raw=${transcript.slice(0, 80)}` : undefined,
            };
            persistVoiceFailure('whisper_failed', result.detail);
            return result;
          }
          return { transcript: accepted };
        } catch (error) {
          if (error instanceof VoiceFailureError) {
            persistVoiceFailure(error.causeCode, error.message);
            return { failed: error.causeCode, detail: error.message };
          }
          const detail = error instanceof Error ? error.message : String(error);
          const cause = classifyVoiceFailure(detail);
          persistVoiceFailure(cause, detail);
          return { failed: cause, detail };
        }
      })();
      return finishing;
    },

    async cancel() {
      clearTimers();
      signalAutoStop(null);
      if (recording) {
        try {
          await finishMicRecorder(recording);
        } catch {
          /* ignore */
        }
        recording = null;
        await restorePoppinsAudio().catch(() => undefined);
      }
      active = false;
      finishing = null;
      stopRequested = true;
      onAutoStop = undefined;
      autoStoppedUri = undefined;
    },
  };

  return api;
}

/** Expose whether metering was seen (tests). */
export const QUIET_MIN_WHISPER_MS = MIN_WHISPER_MS;
export const QUIET_HARD_CAP_MS = HARD_CAP_MS;
