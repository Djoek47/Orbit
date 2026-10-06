/**
 * Short offline clips for Settings → How Poppins sounds.
 * Baked by scripts/generate-voice-previews.mjs (gpt-4o-mini-tts).
 * Line: "Ready when you are."
 */

import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';

const PREVIEWS: Partial<Record<MajordomoVoiceId, number>> = {
  coral: require('@/assets/voice-previews/coral.m4a'),
  shimmer: require('@/assets/voice-previews/shimmer.m4a'),
  sage: require('@/assets/voice-previews/sage.m4a'),
  ballad: require('@/assets/voice-previews/ballad.m4a'),
  alloy: require('@/assets/voice-previews/alloy.m4a'),
  verse: require('@/assets/voice-previews/verse.m4a'),
  marin: require('@/assets/voice-previews/marin.m4a'),
  echo: require('@/assets/voice-previews/echo.m4a'),
  ash: require('@/assets/voice-previews/ash.m4a'),
  cedar: require('@/assets/voice-previews/cedar.m4a'),
};

export const VOICE_PREVIEW_LINE = 'Ready when you are.';

export function voicePreviewAudio(voiceId: MajordomoVoiceId): number | null {
  return PREVIEWS[voiceId] ?? null;
}
