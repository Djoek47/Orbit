/**
 * Quiet transcript gate — no native imports so Node tests can load it.
 * Never invent a sentence the user did not say.
 */

const QUIET_HALLUCINATIONS = new Set([
  'thank you',
  'thanks for watching',
  'you',
  'bye',
  // WO9.1 / A3 — fabricated Whisper fallback must never reach Base mode.
  'what should our household focus on right now',
]);

/** Drop empty, tiny, or known silence hallucinations. */
export function acceptQuietTranscript(text: string | null | undefined): string | null {
  const cleaned = text?.trim().replace(/[.!?]+$/g, '').trim().toLowerCase() ?? '';
  if (cleaned.length < 2) return null;
  if (QUIET_HALLUCINATIONS.has(cleaned)) return null;
  return text!.trim();
}
