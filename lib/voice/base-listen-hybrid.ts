/**
 * Apple-first Base listening, cloud STT when Apple fails or mishears.
 *
 * Understanding stays local (parsers). Cloud is transcript-only English.
 */
import type { BaseListenFailure } from '@/lib/voice/base-listener';
import {
  shouldEscalateAppleTranscript,
  type CloudListenReason,
} from '@/lib/voice/listen-quality';

export type HybridListenAction =
  | { action: 'use_text'; text: string }
  | { action: 'cloud'; reason: CloudListenReason }
  | { action: 'trouble'; reason: BaseListenFailure };

/** Failures where Apple cannot deliver English words — go straight to cloud when available. */
export function appleFailurePrefersCloud(reason: BaseListenFailure): boolean {
  return (
    reason === 'language' ||
    reason === 'network' ||
    reason === 'unavailable' ||
    reason === 'audio'
  );
}

/** End-of-session reasons that should open a cloud listen pass. */
export function appleEndedPrefersCloud(why: 'stopped' | 'failure' | 'idle' | 'silent_start'): boolean {
  return why === 'silent_start';
}

/**
 * Decide what to do with a finished Apple sentence.
 * `preferCloud` is sticky for the rest of the Base session after a prior mishear.
 */
export function resolveAppleUtterance(
  text: string,
  preferCloud: boolean
): HybridListenAction {
  if (preferCloud) return { action: 'cloud', reason: 'prefer' };
  const escalate = shouldEscalateAppleTranscript(text);
  if (escalate) return { action: 'cloud', reason: escalate };
  return { action: 'use_text', text: text.trim() };
}

export function resolveAppleFailure(
  reason: BaseListenFailure,
  cloudAvailable: boolean
): HybridListenAction {
  if (cloudAvailable && appleFailurePrefersCloud(reason)) {
    return { action: 'cloud', reason: 'failure' };
  }
  return { action: 'trouble', reason };
}
