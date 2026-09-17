/**
 * Revision G §7.4 Propose — name + optional note, 7-day cooldown, one open proposal.
 */

export const PROPOSAL_COOLDOWN_DAYS = 7;

export type RewardProposal = {
  id: string;
  householdId: string;
  memberId: string;
  memberName: string;
  title: string;
  note?: string;
  status: 'open' | 'approved' | 'declined';
  createdAt: string;
  decidedAt?: string;
};

export function canProposeReward(opts: {
  hasOpenProposal: boolean;
  lastProposedAt?: string | null;
  now?: Date;
}): { ok: true } | { ok: false; reason: 'open' | 'cooldown' } {
  if (opts.hasOpenProposal) return { ok: false, reason: 'open' };
  if (!opts.lastProposedAt) return { ok: true };
  const now = opts.now ?? new Date();
  const last = new Date(opts.lastProposedAt);
  if (Number.isNaN(last.getTime())) return { ok: true };
  const elapsed = now.getTime() - last.getTime();
  // TODO(product): Is a seven-day proposal cooldown the right cadence? Default shipped: seven days.
  if (elapsed < PROPOSAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, reason: 'cooldown' };
  }
  return { ok: true };
}

export function proposalPayload(title: string, note?: string): { title: string; note?: string } {
  const trimmed = title.trim();
  const extra = note?.trim();
  return extra ? { title: trimmed, note: extra } : { title: trimmed };
}
