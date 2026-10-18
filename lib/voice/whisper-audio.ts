/**
 * Pure helpers for Quiet / poppins-voice Whisper uploads.
 * OpenAI gpt-4o(-mini)-transcribe is strict about format + Content-Type matching;
 * Expo HIGH_QUALITY records AAC-in-MP4 (.m4a) which must be tagged audio/mp4.
 */

/** MIME the client and edge function send with Quiet / Poppins m4a captures. */
export const QUIET_AUDIO_MIME = 'audio/mp4';
export const QUIET_AUDIO_FILENAME = 'poppins.m4a';

/** Tiny decoded payloads are almost always silence / a broken capture — skip OpenAI. */
export const MIN_WHISPER_AUDIO_BYTES = 256;

/** Fallback when gpt-4o-mini-transcribe rejects a valid capture (format quirks). */
export const WHISPER_FALLBACK_MODEL = 'whisper-1';

export function normalizeVoiceMimeType(mime: string | null | undefined): string {
  const raw = (mime ?? '').trim().toLowerCase();
  if (!raw || raw === 'audio/m4a' || raw === 'audio/x-m4a' || raw === 'audio/aac') {
    return QUIET_AUDIO_MIME;
  }
  // Strip codec parameters: "audio/webm;codecs=opus" → "audio/webm"
  const base = raw.split(';')[0]!.trim();
  return base || QUIET_AUDIO_MIME;
}

/** Pull a short OpenAI error code/message for Support detail lines. */
export function openaiWhisperErrorDetail(
  status: number,
  body: unknown
): string {
  const row =
    body && typeof body === 'object'
      ? (body as { error?: { message?: string; code?: string } | string; message?: string })
      : null;
  const err = row?.error;
  const code =
    err && typeof err === 'object' && typeof err.code === 'string' ? err.code.trim() : '';
  const message =
    err && typeof err === 'object' && typeof err.message === 'string'
      ? err.message.trim()
      : typeof err === 'string'
        ? err.trim()
        : typeof row?.message === 'string'
          ? row.message.trim()
          : '';
  const hint = (code || message || 'upstream').replace(/\s+/g, ' ').slice(0, 120);
  return `openai_${status}:${hint}`;
}

/** Retry primary model 400/415 with whisper-1 — GPT-4o STT is pickier than whisper-1. */
export function shouldRetryWhisperFallback(status: number): boolean {
  return status === 400 || status === 415;
}
