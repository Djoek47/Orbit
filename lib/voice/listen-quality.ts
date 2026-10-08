/**
 * Is this transcript good enough for Base's local parsers, or should we escalate to cloud STT?
 *
 * Apple's recogniser on a French-region phone used to emit French even when we asked for
 * English. Cloud STT (Whisper / gpt-4o-mini-transcribe) with language locked to `en` is the
 * fallback — listening only, not understanding.
 */

const FRENCH_MARKERS =
  /\b(une|des|les|pour|avec|chez|merci|bonjour|bonsoir|salut|est[- ]ce|peux(?:-tu)?|pouvez|rajouter|ajouter|calendrier|rendez[- ]vous|t[aâ]che|aujourd'?hui|demain|apr[eè]s|matin|soir|s'?il yous? pla[iî]t|je veux|je peux|tu peux)\b/i;

const FRENCH_DIACRITICS = /[àâäæçéèêëïîôœùûüÿÀÂÄÆÇÉÈÊËÏÎÔŒÙÛÜŸ]/;

/** Accented French letters, or several common French function words. */
export function looksNonEnglish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (FRENCH_DIACRITICS.test(t)) return true;
  const hits = t.match(new RegExp(FRENCH_MARKERS.source, 'gi'));
  return (hits?.length ?? 0) >= 2;
}

/** Empty or too thin to act on — escalate rather than invent. */
export function isWeakTranscript(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // A single filler / acknowledgement is not an act.
  if (/^(um+|uh+|erm+|hmm+|ah+|oh+|ok|okay|yes|no|hey|hi|hello)\.?$/i.test(t)) return true;
  return t.replace(/[^\p{L}\p{N}]+/gu, '').length < 2;
}

export type CloudListenReason = 'silent' | 'failure' | 'non_english' | 'weak' | 'prefer';

/**
 * After Apple finishes a sentence, should Base trust it or ask cloud STT instead?
 * Cloud needs a fresh recording — we never re-decode Apple's audio buffer.
 */
export function shouldEscalateAppleTranscript(text: string): CloudListenReason | null {
  if (isWeakTranscript(text)) return 'weak';
  if (looksNonEnglish(text)) return 'non_english';
  return null;
}
