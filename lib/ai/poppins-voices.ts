/**
 * Poppins' voices, chosen by colour.
 *
 *   warmer ◀───────────── the wheel ─────────────▶ cooler
 *     ●        ●        ●        ●        ●        ●
 *   Rose     Amber    Sand     Moss     Slate    Indigo
 *   ── higher, brighter ──┼── even ──┼── lower, fuller ──
 *
 * There is only one assistant, and it is always called Poppins. A "voice" is not a second
 * character with a name and a personality — it is how Poppins sounds. So the picker is a
 * colour wheel: warm colours sit at the brighter, higher end and cool colours at the lower,
 * fuller end, with even voices in between. Nothing here changes what Poppins says.
 */
import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';

/** Where a voice sits on the wheel: 0 is the brightest end, 1 the fullest. */
export type PoppinsVoice = {
  id: MajordomoVoiceId;
  /** Colour name — this is what a person picks by. */
  label: string;
  color: string;
  /** 0 → 1 across the wheel. */
  position: number;
  /** One short line, so the choice isn't blind. */
  hint: string;
};

/** In wheel order, brightest first. */
export const POPPINS_VOICES: PoppinsVoice[] = [
  { id: 'coral', label: 'Rose', color: '#FF7AA2', position: 0, hint: 'Bright and warm' },
  { id: 'shimmer', label: 'Amber', color: '#FF9F1C', position: 0.2, hint: 'Light and lively' },
  { id: 'sage', label: 'Sand', color: '#E9C46A', position: 0.4, hint: 'Even and easy' },
  { id: 'alloy', label: 'Moss', color: '#7FC24A', position: 0.6, hint: 'Even and steady' },
  { id: 'marin', label: 'Slate', color: '#7C9CC0', position: 0.8, hint: 'Low and calm' },
  { id: 'cedar', label: 'Indigo', color: '#6C63FF', position: 1, hint: 'Full and deep' },
];

export const DEFAULT_POPPINS_VOICE: MajordomoVoiceId = 'coral';

const BY_ID = new Map(POPPINS_VOICES.map((voice) => [voice.id, voice]));

export function isPoppinsVoiceId(value: unknown): value is MajordomoVoiceId {
  return typeof value === 'string' && BY_ID.has(value as MajordomoVoiceId);
}

export function poppinsVoice(id?: string | null): PoppinsVoice {
  if (id && BY_ID.has(id as MajordomoVoiceId)) return BY_ID.get(id as MajordomoVoiceId)!;
  return BY_ID.get(DEFAULT_POPPINS_VOICE)!;
}

/**
 * Which voice this household speaks with.
 *
 * Households set up before the wheel stored a character id instead ('steward', 'advisor'…).
 * Those characters are gone — everything is Poppins now — but the *sound* they picked is
 * kept, so nobody's assistant changes voice overnight.
 */
export function resolvePoppinsVoice(options: {
  /** The new setting: a voice id. */
  voiceId?: string | null;
  /** The old setting: a character id, whose voice we inherit. */
  legacyProfileId?: string | null;
  /** Voices by legacy character, injected so this module stays free of that table. */
  legacyVoiceFor?: (profileId: string) => string | undefined;
}): MajordomoVoiceId {
  if (isPoppinsVoiceId(options.voiceId)) return options.voiceId;
  const inherited = options.legacyProfileId
    ? options.legacyVoiceFor?.(options.legacyProfileId)
    : undefined;
  if (isPoppinsVoiceId(inherited)) return inherited;
  return DEFAULT_POPPINS_VOICE;
}

/** The voice nearest a point on the wheel — for dragging rather than tapping. */
export function voiceAtPosition(position: number): PoppinsVoice {
  const clamped = Math.min(1, Math.max(0, position));
  return POPPINS_VOICES.reduce((best, voice) =>
    Math.abs(voice.position - clamped) < Math.abs(best.position - clamped) ? voice : best
  );
}
