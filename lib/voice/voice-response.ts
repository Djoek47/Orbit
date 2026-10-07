/**
 * How Quiet reads the poppins-voice function's answer. Pure — no native modules — so the
 * rules are testable in Node.
 */
import { VoiceFailureError, classifyVoiceFailure } from '@/lib/voice/quiet-failures';

export type VoiceResponse = {
  status: number;
  ok: boolean;
  payload: { transcript?: unknown; answer?: unknown; error?: unknown; detail?: unknown };
};

/** An older deployment calls req.formData() on the JSON body and answers 500. */
export function serverNeedsMultipart(res: Pick<VoiceResponse, 'status' | 'payload'>): boolean {
  if (res.status !== 500 && res.status !== 400 && res.status !== 415) return false;
  return /form ?data|multipart|content-type|boundary/i.test(String(res.payload.error ?? ''));
}

/**
 * Turn the function's answer into a transcript, or a failure that names its real cause.
 * The function returns a precise `detail` (audio_not_file, openai_400:…, OPENAI_API_KEY
 * missing…) that used to be thrown away, leaving only "whisper_failed".
 *
 * Gateway status is labeled `edge N` so it is never confused with an upstream
 * `openai_400` / legacy `http_400` in the same Support line.
 */
export function voiceResult(res: VoiceResponse): { transcript: string; answer: string } {
  const { payload, status } = res;
  if (!res.ok || payload.error) {
    const upstream = payload.detail ? String(payload.detail) : '';
    const detail = [
      String(payload.error ?? 'voice_request_failed'),
      upstream || null,
      `edge ${status}`,
    ]
      .filter(Boolean)
      .join(' · ');
    if (status === 401 || status === 403) {
      throw new VoiceFailureError('signed_out', detail);
    }
    throw new VoiceFailureError(classifyVoiceFailure(detail), detail);
  }
  return {
    transcript: String(payload.transcript ?? ''),
    answer: String(payload.answer ?? ''),
  };
}
