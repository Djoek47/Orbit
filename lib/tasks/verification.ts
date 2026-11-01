/**
 * Occurrence verification — separate from status (§1.7).
 * XP awards on Complete tap; verification is oversight after the fact.
 */

export type TaskVerification =
  | 'not_required'
  | 'unreviewed'
  | 'confirmed'
  | 'proof_requested'
  | 'rejected';

export type ProofRound = {
  note?: string;
  /** Sidekick written reply when they answer a proof request. */
  responseNote?: string;
  requestedAt: string;
  requestedByMemberId?: string;
};

/**
 * A safety stop, not the rule. The real limit is the 7-day window: inside it an admin can
 * keep saying "not done yet, show me again" for as long as it takes.
 */
export const PROOF_ROUND_CAP = 12;
export const UNREVIEWED_AUTO_CONFIRM_HOURS = 72;
export const REVERSAL_WINDOW_DAYS = 7;

export function initialVerification(requiresPhoto: boolean): TaskVerification {
  return requiresPhoto ? 'unreviewed' : 'not_required';
}

export function canRequestAnotherProof(
  verification: TaskVerification,
  rounds: ProofRound[]
): boolean {
  // Confirmed is the end of the loop — the admin said it's done.
  if (verification === 'confirmed') return false;
  // Rejected is not the end: "that photo doesn't show it done" is exactly when you ask
  // again. The loop closes when the admin confirms, or when the 7-day window runs out
  // (checked by the caller, which knows when the chore was finished).
  if (
    verification !== 'not_required' &&
    verification !== 'unreviewed' &&
    verification !== 'proof_requested' &&
    verification !== 'rejected'
  ) {
    return false;
  }
  return rounds.length < PROOF_ROUND_CAP;
}

export function canMarkNotDone(completedAt: string | undefined, now = new Date()): boolean {
  if (!completedAt) return false;
  const completed = new Date(completedAt).getTime();
  if (Number.isNaN(completed)) return false;
  const maxMs = REVERSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - completed <= maxMs;
}

export function shouldAutoConfirm(
  verification: TaskVerification,
  completedAt: string | undefined,
  now = new Date()
): boolean {
  if (verification !== 'unreviewed' || !completedAt) return false;
  const completed = new Date(completedAt).getTime();
  if (Number.isNaN(completed)) return false;
  const maxMs = UNREVIEWED_AUTO_CONFIRM_HOURS * 60 * 60 * 1000;
  return now.getTime() - completed >= maxMs;
}
