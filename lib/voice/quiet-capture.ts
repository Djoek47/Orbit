/**
 * Quiet (Speak back off) voice capture — batch Whisper only.
 * Never opens a Realtime / PoppinsVoiceSession.
 */

import type { AudioRecorder } from 'expo-audio';

import { saveLastAppError } from '@/lib/errors/last-error';
import { configurePoppinsSpeakerAudio, restorePoppinsAudio } from '@/lib/voice/audio-route';
import {
  finishMicRecorder,
  micUnavailableMessage,
  requestMicPermission,
  startMicRecorder,
} from '@/lib/voice/mic-capture';
import { transcribeQuietAudio } from '@/lib/voice/poppins-voice';
import { acceptQuietTranscript } from '@/lib/voice/quiet-transcript';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const SILENCE_DB = -40;
const SILENCE_AFTER_SPEECH_MS = 1200;
/** Fixed silence auto-stop when metering never arrives (expo-audio optional metering). */
const METERING_FALLBACK_AUTO_STOP_MS = 2500;
const HARD_CAP_MS = 30_000;
const POLL_MS = 100;
/** Min recording length before we bother Whisper (A1). */
const MIN_WHISPER_MS = 700;
/** After this many polls with no metering number, fall back (A1). */
const METERING_PROBE_POLLS = 10;

export type QuietStopFailure = {
  failed: 'no_audio' | 'too_short' | 'transcribe_failed' | 'empty_transcript';
  detail?: string;
};

export type QuietStopResult = { transcript: string } | QuietStopFailure;

export type QuietCapture = {
  start(opts: {
    onPartial?: (text: string) => void;
    onLevel?: (db: number) => void;
    onStatus?: (status: 'listening' | 'transcribing' | 'got_it') => void;
    /** Fired when silence or the 30s cap stops the recording. Caller should `stop()`. */
    onAutoStop?: () => void;
  }): Promise<void>;
  /** Stop recording and return Whisper transcript or a typed failure (A2). */
  stop(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<QuietStopResult>;
  cancel(): Promise<void>;
  readonly streaming: boolean;
  readonly active: boolean;
};

export const QUIET_FAILURE_MESSAGES: Record<QuietStopFailure['failed'], string> = {
  no_audio: "The microphone didn't record anything. Check microphone access in iOS Settings.",
  too_short: 'That was too short — hold the button and say it again.',
  transcribe_failed: "I couldn't reach the transcriber. Check your connection.",
  empty_transcript: "I didn't hear words. The mic recorded silence. Hold, speak, let go.",
};

function persistVoiceFailure(failed: QuietStopFailure['failed'], detail?: string) {
  void saveLastAppError({
    message: `voice:${failed}${detail ? ` ${detail}` : ''}`,
    at: new Date().toISOString(),
  });
}

/**
 * Batch Quiet capture via expo-audio → Whisper (`transcriptOnly`).
 * Streaming on-device recognition is intentionally not used this pass (Expo Go).
 */
export function createQuietCapture(): QuietCapture {
  let recording: AudioRecorder | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
  let meteringFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let heardSpeech = false;
  let silenceSince: number | null = null;
  let startedAt = 0;
  let noiseFloor = SILENCE_DB;
  let floorLocked = false;
  const floorSamples: number[] = [];
  let active = false;
  let finishing: Promise<QuietStopResult> | null = null;
  let onLevel: ((db: number) => void) | undefined;
  let onStatus: ((status: 'listening' | 'transcribing' | 'got_it') => void) | undefined;
  let onPartial: ((text: string) => void) | undefined;
  let onAutoStop: (() => void) | undefined;
  let autoStoppedUri: string | null | undefined;
  let autoStopWaiters: Array<(uri: string | null) => void> = [];
  let stopRequested = false;
  let pollCount = 0;
  let meteringSeen = false;
  let meteringUnavailableLogged = false;
  let meteringFallbackArmed = false;

  const clearTimers = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (hardCapTimer) {
      clearTimeout(hardCapTimer);
      hardCapTimer = null;
    }
    if (meteringFallbackTimer) {
      clearTimeout(meteringFallbackTimer);
      meteringFallbackTimer = null;
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

  const armMeteringFallback = () => {
    if (meteringFallbackArmed || meteringSeen) return;
    meteringFallbackArmed = true;
    if (!meteringUnavailableLogged) {
      meteringUnavailableLogged = true;
      console.warn('voice.metering_unavailable');
    }
    meteringFallbackTimer = setTimeout(() => {
      void requestAutoStop();
    }, METERING_FALLBACK_AUTO_STOP_MS);
  };

  const api: QuietCapture = {
    get streaming() {
      return false;
    },
    get active() {
      return active;
    },

    async start(opts) {
      if (active) return;
      onLevel = opts.onLevel;
      onStatus = opts.onStatus;
      onPartial = opts.onPartial;
      onAutoStop = opts.onAutoStop;
      heardSpeech = false;
      silenceSince = null;
      startedAt = Date.now();
      noiseFloor = SILENCE_DB;
      floorLocked = false;
      floorSamples.length = 0;
      active = true;
      finishing = null;
      stopRequested = false;
      autoStoppedUri = undefined;
      pollCount = 0;
      meteringSeen = false;
      meteringUnavailableLogged = false;
      meteringFallbackArmed = false;
      onStatus?.('listening');
      onPartial?.('Listening…');

      const allowed = await requestMicPermission();
      if (!allowed) {
        active = false;
        throw new Error(micUnavailableMessage());
      }

      await configurePoppinsSpeakerAudio();
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
            if (hasMetering) meteringSeen = true;
            else if (pollCount >= METERING_PROBE_POLLS) armMeteringFallback();

            const db = hasMetering ? status.metering! : -160;
            onLevel?.(db);
            // Metering is only for silence auto-stop + level UI — not a Whisper gate (A1).
            if (!hasMetering) return;

            const elapsed = Date.now() - startedAt;
            if (!floorLocked) {
              floorSamples.push(db);
              if (elapsed < 300) return;
              const sorted = [...floorSamples].sort((a, b) => a - b);
              const mid = sorted[Math.floor(sorted.length / 2)] ?? SILENCE_DB;
              noiseFloor = Math.min(-25, Math.max(-50, mid + 10));
              floorLocked = true;
            }
            const threshold = noiseFloor;
            if (db > threshold) {
              heardSpeech = true;
              silenceSince = null;
              return;
            }
            if (!heardSpeech) return;
            const now = Date.now();
            if (silenceSince == null) silenceSince = now;
            if (now - silenceSince >= SILENCE_AFTER_SPEECH_MS) {
              await requestAutoStop();
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
          persistVoiceFailure(result.failed);
          return result;
        }

        // A1: send to Whisper whenever URI exists and duration >= 700ms — ignore heardSpeech.
        if (durationMillis < MIN_WHISPER_MS) {
          const result: QuietStopFailure = {
            failed: 'too_short',
            detail: `durationMs=${durationMillis}`,
          };
          persistVoiceFailure(result.failed, result.detail);
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
            persistVoiceFailure(result.failed, result.detail);
            return result;
          }
          return { transcript: accepted };
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const result: QuietStopFailure = { failed: 'transcribe_failed', detail };
          persistVoiceFailure(result.failed, detail);
          return result;
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
