/**
 * Quiet (Speak back off) voice capture — batch Whisper only.
 * Never opens a Realtime / PoppinsVoiceSession.
 */

import { Audio } from 'expo-av';

import { configurePoppinsSpeakerAudio, restorePoppinsAudio } from '@/lib/voice/audio-route';
import { transcribePoppinsAudio } from '@/lib/voice/poppins-voice';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const SILENCE_DB = -40;
const SILENCE_AFTER_SPEECH_MS = 1200;
const HARD_CAP_MS = 30_000;
const POLL_MS = 100;

export type QuietCapture = {
  start(opts: {
    onPartial?: (text: string) => void;
    onLevel?: (db: number) => void;
    onStatus?: (status: 'listening' | 'transcribing' | 'got_it') => void;
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
  let recording: Audio.Recording | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
  let heardSpeech = false;
  let silenceSince: number | null = null;
  let active = false;
  let finishing: Promise<string | null> | null = null;
  let onLevel: ((db: number) => void) | undefined;
  let onStatus: ((status: 'listening' | 'transcribing' | 'got_it') => void) | undefined;
  let onPartial: ((text: string) => void) | undefined;
  let autoStoppedUri: string | null | undefined;
  let autoStopWaiters: Array<(uri: string | null) => void> = [];

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
    if (!active || recording == null) return;
    const uri = await finishRecording();
    signalAutoStop(uri);
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
      heardSpeech = false;
      silenceSince = null;
      active = true;
      finishing = null;
      autoStoppedUri = undefined;
      onStatus?.('listening');
      onPartial?.('Listening…');

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
            if (db > SILENCE_DB) {
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
        if (!uri) return null;
        const transcript = await transcribePoppinsAudio(uri, household, metrics);
        const cleaned = transcript.trim();
        return cleaned || null;
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
      autoStoppedUri = undefined;
    },
  };

  return api;
}
