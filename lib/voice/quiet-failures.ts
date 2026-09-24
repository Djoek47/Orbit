/**
 * WO15 §1.2 — four Quiet failure causes, each with its own line and last-error key.
 */
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
  budget_tripped: "You're out of actions until tomorrow.",
};

/** Map thrown / returned strings from the Quiet path onto a cause. */
export function classifyVoiceFailure(detail: string | undefined | null): VoiceFailureCause {
  const raw = (detail ?? '').toLowerCase();
  if (!raw || raw.includes('voice ai unavailable') || raw.includes('ai unavailable')) {
    return 'ai_off';
  }
  if (
    raw.includes('signed out') ||
    raw.includes('returned empty') ||
    raw.includes('no session') ||
    raw.includes('not authenticated')
  ) {
    return 'signed_out';
  }
  if (raw.includes('budget') || raw.includes('out of actions') || raw.includes('tripped')) {
    return 'budget_tripped';
  }
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
