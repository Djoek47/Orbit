/**
 * Poppins' voice, as a colour.
 *
 * There is one assistant and it is called Poppins. What used to be a list of characters
 * (Steward, Intelligence, …) is now a single choice: a colour on a wheel. Warm colours at
 * one end are the higher, lighter voices; cool colours at the other end are the lower,
 * fuller ones; the middle is even and neutral. Nobody has to read the word "female" to
 * understand a wheel that goes from rose to indigo.
 *
 * `position` runs 0 → 1 along the wheel and doubles as the hue sweep, so the arc drawn on
 * screen and the list below can never disagree.
 */
import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';

/** Which end of the wheel a voice sits at. Shown as a word only in the accessibility label. */
export type VoiceRegister = 'higher' | 'even' | 'lower';

export type PoppinsVoice = {
  /** The provider voice actually used. */
  id: MajordomoVoiceId;
  /** The colour's name — that is the whole product name for a voice now. */
  label: string;
  /** Wheel colour. */
  color: string;
  /** 0 (warm end) → 1 (cool end). */
  position: number;
  /** Two or three words under the name. */
  hint: string;
  register: VoiceRegister;
};

/**
 * Ten voices, warm → cool. Order is the wheel order; `position` is derived from it so a
 * voice can be added or removed without hand-editing ten numbers.
 */
const WHEEL: { id: MajordomoVoiceId; label: string; color: string; hint: string; register: VoiceRegister }[] = [
  { id: 'coral', label: 'Rose', color: '#FF6FA5', hint: 'Bright and warm', register: 'higher' },
  { id: 'shimmer', label: 'Coral', color: '#FF8A6B', hint: 'Light and lively', register: 'higher' },
  { id: 'sage', label: 'Amber', color: '#FFA92E', hint: 'Warm and clear', register: 'higher' },
  { id: 'ballad', label: 'Honey', color: '#E8C24A', hint: 'Soft and unhurried', register: 'higher' },
  { id: 'alloy', label: 'Sand', color: '#B9C44A', hint: 'Even and plain', register: 'even' },
  { id: 'verse', label: 'Moss', color: '#59BC6A', hint: 'Easy and level', register: 'even' },
  { id: 'marin', label: 'Jade', color: '#25BFA6', hint: 'Calm and measured', register: 'even' },
  { id: 'echo', label: 'Slate', color: '#3FA4D8', hint: 'Cool and steady', register: 'lower' },
  { id: 'ash', label: 'Cobalt', color: '#5B7BE8', hint: 'Firm and low', register: 'lower' },
  { id: 'cedar', label: 'Indigo', color: '#7A5BE0', hint: 'Full and deep', register: 'lower' },
];

export const POPPINS_VOICES: PoppinsVoice[] = WHEEL.map((voice, index) => ({
  ...voice,
  position: WHEEL.length > 1 ? index / (WHEEL.length - 1) : 0,
}));

export const DEFAULT_POPPINS_VOICE_ID: MajordomoVoiceId = 'coral';

const BY_ID = new Map(POPPINS_VOICES.map((voice) => [voice.id, voice]));

export function isPoppinsVoiceId(value: unknown): value is MajordomoVoiceId {
  return typeof value === 'string' && BY_ID.has(value as MajordomoVoiceId);
}

export function poppinsVoice(id?: string | null): PoppinsVoice {
  if (isPoppinsVoiceId(id)) return BY_ID.get(id)!;
  return BY_ID.get(DEFAULT_POPPINS_VOICE_ID)!;
}

/**
 * The voice this household should speak with.
 *
 * `voiceId` is the new setting. Households that chose a character before this change still
 * have a profile id stored, so its voice carries over rather than snapping back to Rose.
 */
export function resolvePoppinsVoice(options: {
  voiceId?: string | null;
  /** Legacy `majordomoProfileId`. */
  legacyProfileId?: string | null;
  /** Legacy profile → voice lookup, injected so this module stays free of the profile table. */
  legacyVoiceFor?: (profileId: string) => string | null | undefined;
}): MajordomoVoiceId {
  if (isPoppinsVoiceId(options.voiceId)) return options.voiceId;
  const legacy = options.legacyProfileId
    ? options.legacyVoiceFor?.(options.legacyProfileId)
    : null;
  if (isPoppinsVoiceId(legacy)) return legacy;
  return DEFAULT_POPPINS_VOICE_ID;
}

/** The voice nearest a point on the wheel — what a drag or a tap resolves to. */
export function voiceAtPosition(position: number): PoppinsVoice {
  const p = Math.min(1, Math.max(0, position));
  let best = POPPINS_VOICES[0]!;
  for (const voice of POPPINS_VOICES) {
    if (Math.abs(voice.position - p) < Math.abs(best.position - p)) best = voice;
  }
  return best;
}

// ── Wheel geometry ────────────────────────────────────────────────────────────
// The arc is drawn as a run of short solid segments whose colours are interpolated
// between neighbouring voices, which gives a smooth sweep without a conic gradient.

/** Degrees the arc covers, and where it starts (0° = 12 o'clock, clockwise). */
export const WHEEL_SWEEP_DEG = 268;
export const WHEEL_START_DEG = -134;

export function angleForPosition(position: number): number {
  return WHEEL_START_DEG + Math.min(1, Math.max(0, position)) * WHEEL_SWEEP_DEG;
}

/** Inverse of `angleForPosition`, clamped to the arc so a drag past the end just stops. */
export function positionForAngle(deg: number): number {
  return Math.min(1, Math.max(0, (deg - WHEEL_START_DEG) / WHEEL_SWEEP_DEG));
}

/**
 * A touch relative to the wheel's centre, as a position on the arc. Angles in the gap
 * below the arc snap to whichever end they are closer to, so a clumsy drag never jumps
 * from Rose to Indigo.
 */
export function positionForTouch(dx: number, dy: number): number {
  // atan2 from 12 o'clock, clockwise, in −180…180.
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const end = WHEEL_START_DEG + WHEEL_SWEEP_DEG;
  if (deg < WHEEL_START_DEG || deg > end) {
    // Below the arc: pick the nearer end going the short way round.
    const toStart = Math.min(Math.abs(deg - WHEEL_START_DEG), 360 - Math.abs(deg - WHEEL_START_DEG));
    const toEnd = Math.min(Math.abs(deg - end), 360 - Math.abs(deg - end));
    deg = toStart <= toEnd ? WHEEL_START_DEG : end;
  }
  return positionForAngle(deg);
}

function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function hex2(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
}

/** The wheel's colour at any point, blended between the two nearest voices. */
export function colorAtPosition(position: number): string {
  const p = Math.min(1, Math.max(0, position));
  const last = POPPINS_VOICES.length - 1;
  const scaled = p * last;
  const lower = Math.min(last, Math.floor(scaled));
  const upper = Math.min(last, lower + 1);
  const t = scaled - lower;
  const [r1, g1, b1] = channels(POPPINS_VOICES[lower]!.color);
  const [r2, g2, b2] = channels(POPPINS_VOICES[upper]!.color);
  return `#${hex2(r1 + (r2 - r1) * t)}${hex2(g1 + (g2 - g1) * t)}${hex2(b1 + (b2 - b1) * t)}`;
}

export type WheelSegment = { from: number; to: number; color: string };

/** `count` segments spanning the arc, each already coloured. */
export function wheelSegments(count = 60): WheelSegment[] {
  const n = Math.max(2, Math.round(count));
  return Array.from({ length: n }, (_, i) => {
    const from = i / n;
    const to = (i + 1) / n;
    return { from, to, color: colorAtPosition((from + to) / 2) };
  });
}

/** Spoken line Poppins previews a voice with. */
export function voicePreviewLine(voice: PoppinsVoice): string {
  return `This is ${voice.label}. I'll sound like this when I speak back.`;
}

/** What the wheel reads as to a screen reader. */
export function voiceAccessibilityLabel(voice: PoppinsVoice): string {
  const register =
    voice.register === 'higher' ? 'higher voice' : voice.register === 'lower' ? 'lower voice' : 'even voice';
  return `${voice.label} — ${voice.hint}, ${register}. ${Math.round(voice.position * 100)} percent along the wheel.`;
}
