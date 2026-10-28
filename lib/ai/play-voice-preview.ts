/**
 * Play a short line in the chosen Poppins colour-voice.
 * Prefers baked gpt-4o-mini-tts clips (zero runtime cost). Falls back to device
 * Speech with pitch/rate from wheel position so Expo Go can still differentiate.
 */
import * as Speech from 'expo-speech';

import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';
import { poppinsVoice } from '@/lib/ai/poppins-voices';
import { devicePreviewProsody, voicePreviewPhrase } from '@/lib/ai/voice-preview-copy';
import { voicePreviewAudio } from '@/lib/ai/voice-preview-audio';
import { restorePoppinsAudio } from '@/lib/voice/audio-route';
import type { AudioPlayer } from 'expo-audio';

export { devicePreviewProsody, voicePreviewPhrase } from '@/lib/ai/voice-preview-copy';

let player: AudioPlayer | null = null;
let generation = 0;

function haltPlayback() {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      /* ignore */
    }
    player = null;
  }
}

export async function stopVoicePreview() {
  generation += 1;
  haltPlayback();
}

export async function playVoicePreview(options: {
  voiceId: MajordomoVoiceId;
  /** Used only for the device-Speech line (baked clips are a fixed phrase). */
  memberFirstName?: string | null;
  onDone?: () => void;
}): Promise<'baked' | 'device' | 'skipped'> {
  const token = ++generation;
  haltPlayback();

  const voice = poppinsVoice(options.voiceId);
  const baked = voicePreviewAudio(voice.id);
  const done = () => {
    if (generation === token) options.onDone?.();
  };

  if (baked != null) {
    try {
      const { createAudioPlayer } = await import('expo-audio');
      await restorePoppinsAudio();
      if (generation !== token) return 'skipped';
      const next = createAudioPlayer(baked);
      player = next;
      next.play();
      const started = Date.now();
      const tick = () => {
        if (generation !== token) return;
        const elapsed = Date.now() - started;
        const finished =
          elapsed > 280 && !next.playing && (next.currentTime ?? 0) > 0.05;
        if (finished || elapsed > 12_000) {
          try {
            next.remove();
          } catch {
            /* ignore */
          }
          if (player === next) player = null;
          done();
          return;
        }
        setTimeout(tick, 120);
      };
      setTimeout(tick, 200);
      return 'baked';
    } catch (error) {
      console.warn('[voice-preview] baked play failed; device fallback', error);
    }
  }

  if (generation !== token) return 'skipped';
  const phrase = voicePreviewPhrase(options.memberFirstName);
  const prosody = devicePreviewProsody(voice);
  await restorePoppinsAudio();
  if (generation !== token) return 'skipped';
  Speech.speak(phrase, {
    language: 'en-US',
    pitch: prosody.pitch,
    rate: prosody.rate,
    onDone: done,
    onStopped: done,
    onError: done,
  });
  return 'device';
}
