/**
 * WO15 §1.2 — four Quiet failure causes, each with its own line and last-error key.
 */
import { POPPINS_PAUSED_COPY } from '@/lib/ai/credits';
import { saveLastAppError } from '@/lib/errors/last-error';

export type VoiceFailureCause =
  | 'ai_off'
  | 'signed_out'
  | 'whisper_failed'
  | 'budget_tripped';

export const VOICE_FAILURE_MESSAGES: Record<VoiceFailureCause, string> = {
  ai_off: 'Poppins AI is off in this build.',
  signed_out: "You're signed out — sign in to use Poppins.",
  whisper_failed: "I couldn't reach the transcriber.",
  /** Prefer POPPINS_PAUSED_COPY at call sites when monthly vs daily is known. */
  budget_tripped: POPPINS_PAUSED_COPY,
};

/** Map thrown / returned strings from the Quiet path onto a cause. */
export function classifyVoiceFailure(detail: string | undefined | null): VoiceFailureCause {
  const raw = (detail ?? '').trim().toLowerCase();
  // Empty / unknown → whisper, never ai_off (audit §3 P2).
  if (!raw) return 'whisper_failed';
  if (raw.includes('voice ai unavailable') || raw.includes('ai unavailable') || raw === 'ai_off') {
    return 'ai_off';
  }
  if (
    raw.includes('signed out') ||
    raw.includes('no session') ||
    raw.includes('not authenticated') ||
    raw.includes('401') ||
    raw.includes('unauthorized') ||
    raw.includes('jwt expired') ||
    raw.includes('token expired')
  ) {
    return 'signed_out';
  }
  if (raw.includes('budget') || raw.includes('out of actions') || raw.includes('tripped')) {
    return 'budget_tripped';
  }
  // "returned empty" without auth context is whisper, not signed_out.
  return 'whisper_failed';
}

export function voiceFailureMessage(cause: VoiceFailureCause): string {
  return VOICE_FAILURE_MESSAGES[cause];
}

/** Persist for Settings → Help → Last error (`voice:` prefix). */
export function persistVoiceFailure(cause: VoiceFailureCause, detail?: string): void {
  void saveLastAppError({
    message: `voice:${cause}${detail ? ` ${detail}` : ''}`,
    at: new Date().toISOString(),
  });
}

export class VoiceFailureError extends Error {
  readonly causeCode: VoiceFailureCause;
  constructor(cause: VoiceFailureCause, detail?: string) {
    super(detail ? `${VOICE_FAILURE_MESSAGES[cause]} (${detail})` : VOICE_FAILURE_MESSAGES[cause]);
    this.name = 'VoiceFailureError';
    this.causeCode = cause;
  }
}
