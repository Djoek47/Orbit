/**
 * Quiet (Speak back off) voice capture — batch Whisper only.
 * Never opens a Realtime / PoppinsVoiceSession.
 */

import { configurePoppinsSpeakerAudio, restorePoppinsAudio } from '@/lib/voice/audio-route';
import {
  expoAvUnavailableMessage,
  getExpoAv,
} from '@/lib/voice/expo-av-safe';
import { transcribeQuietAudio } from '@/lib/voice/poppins-voice';
import { acceptQuietTranscript } from '@/lib/voice/quiet-transcript';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

type AvRecording = InstanceType<NonNullable<ReturnType<typeof getExpoAv>>['Audio']['Recording']>;

const SILENCE_DB = -40;
const SILENCE_AFTER_SPEECH_MS = 1200;
const HARD_CAP_MS = 30_000;
const POLL_MS = 100;

export type QuietCapture = {
  start(opts: {
    onPartial?: (text: string) => void;
    onLevel?: (db: number) => void;
    onStatus?: (status: 'listening' | 'transcribing' | 'got_it') => void;
    /** Fired when silence or the 30s cap stops the recording. Caller should `stop()`. */
    onAutoStop?: () => void;
  }): Promise<void>;
  /** Stop recording and return Whisper transcript (transcriptOnly). */
  stop(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<string | null>;
  cancel(): Promise<void>;
  readonly streaming: boolean;
  readonly active: boolean;
};

/**
 * Batch Quiet capture via expo-av → Whisper (`transcriptOnly`).
 * Streaming on-device recognition is intentionally not used this pass (Expo Go).
 */
export function createQuietCapture(): QuietCapture {
  let recording: AvRecording | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
  let heardSpeech = false;
  let silenceSince: number | null = null;
  let startedAt = 0;
  let noiseFloor = SILENCE_DB;
  let floorLocked = false;
  const floorSamples: number[] = [];
  let active = false;
  let finishing: Promise<string | null> | null = null;
  let onLevel: ((db: number) => void) | undefined;
  let onStatus: ((status: 'listening' | 'transcribing' | 'got_it') => void) | undefined;
  let onPartial: ((text: string) => void) | undefined;
  let onAutoStop: (() => void) | undefined;
  let autoStoppedUri: string | null | undefined;
  let autoStopWaiters: Array<(uri: string | null) => void> = [];
  let stopRequested = false;

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
      const status = await current.getStatusAsync();
      if (status.isRecording) {
        await current.stopAndUnloadAsync();
      }
      const uri = current.getURI();
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
      onStatus?.('listening');
      onPartial?.('Listening…');

      const av = getExpoAv();
      if (!av) {
        active = false;
        throw new Error(expoAvUnavailableMessage());
      }
      const { Audio } = av;

      await Audio.requestPermissionsAsync();
      await configurePoppinsSpeakerAudio();

      const next = new Audio.Recording();
      await next.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await next.startAsync();
      recording = next;

      pollTimer = setInterval(() => {
        void (async () => {
          if (!recording || !active) return;
          try {
            const status = await recording.getStatusAsync();
            if (!status.isRecording) return;
            const db = typeof status.metering === 'number' ? status.metering : -160;
            onLevel?.(db);
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
      finishing = (async () => {
        onStatus?.('got_it');
        onPartial?.('Got it');
        onStatus?.('transcribing');

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
        if (!heardSpeech || !uri) return null;
        const transcript = await transcribeQuietAudio(uri, household, metrics);
        return acceptQuietTranscript(transcript);
      })();
      return finishing;
    },

    async cancel() {
      clearTimers();
      signalAutoStop(null);
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
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
