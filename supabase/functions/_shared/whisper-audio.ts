/**
 * Deno mirror of lib/voice/whisper-audio.ts — keep in sync.
 * gpt-4o(-mini)-transcribe is strict about format + Content-Type matching.
 */

export const QUIET_AUDIO_MIME = 'audio/mp4';
export const QUIET_AUDIO_FILENAME = 'poppins.m4a';
export const MIN_WHISPER_AUDIO_BYTES = 256;
export const WHISPER_FALLBACK_MODEL = 'whisper-1';

export function normalizeVoiceMimeType(mime: string | null | undefined): string {
  const raw = (mime ?? '').trim().toLowerCase();
  if (!raw || raw === 'audio/m4a' || raw === 'audio/x-m4a' || raw === 'audio/aac') {
    return QUIET_AUDIO_MIME;
  }
  const base = raw.split(';')[0]!.trim();
  return base || QUIET_AUDIO_MIME;
}

export function openaiWhisperErrorDetail(status: number, body: unknown): string {
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

export function shouldRetryWhisperFallback(status: number): boolean {
  return status === 400 || status === 415;
}
