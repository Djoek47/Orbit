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
  requestedAt: string;
  requestedByMemberId?: string;
};

export const PROOF_ROUND_CAP = 3;
export const UNREVIEWED_AUTO_CONFIRM_HOURS = 72;
export const REVERSAL_WINDOW_DAYS = 7;

export function initialVerification(requiresPhoto: boolean): TaskVerification {
  return requiresPhoto ? 'unreviewed' : 'not_required';
}

export function canRequestAnotherProof(
  verification: TaskVerification,
  rounds: ProofRound[]
): boolean {
  if (verification === 'rejected' || verification === 'confirmed') return false;
  // Revision C §1: allow first on-demand request from `not_required` completed chores.
  if (
    verification !== 'not_required' &&
    verification !== 'unreviewed' &&
    verification !== 'proof_requested'
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
