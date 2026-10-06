/**
 * Short offline clips for Settings → How Poppins sounds.
 * Bake with: OPENAI_API_KEY=sk-… node scripts/generate-voice-previews.mjs
 * Until clips are committed, the wheel falls back to a free device preview.
 */

import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';

const PREVIEWS: Partial<Record<MajordomoVoiceId, number>> = {
  // Populate via scripts/generate-voice-previews.mjs, e.g.:
  // coral: require('@/assets/voice-previews/coral.m4a'),
};

export const VOICE_PREVIEW_LINE = 'Ready when you are.';

export function voicePreviewAudio(voiceId: MajordomoVoiceId): number | null {
  return PREVIEWS[voiceId] ?? null;
}

export function hasBakedVoicePreviews(): boolean {
  return Object.keys(PREVIEWS).length > 0;
}
