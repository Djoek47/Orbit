import type { PoppinsVoice } from '@/lib/ai/poppins-voices';
import { VOICE_PREVIEW_LINE } from '@/lib/ai/voice-preview-audio';

export function voicePreviewPhrase(memberFirstName?: string | null): string {
  const name = memberFirstName?.trim();
  if (name) return `Hi ${name}. ${VOICE_PREVIEW_LINE}`;
  return VOICE_PREVIEW_LINE;
}

/** Pitch / rate for the free device fallback — higher at the warm end of the wheel. */
export function devicePreviewProsody(voice: PoppinsVoice): { pitch: number; rate: number } {
  const t = Math.min(1, Math.max(0, voice.position));
  return {
    pitch: 1.28 - t * 0.55,
    rate: 0.98 - t * 0.06,
  };
}
