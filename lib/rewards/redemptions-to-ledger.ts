/**
 * Map persisted reward_redemptions into Reward history ledger rows.
 */
import type { Reward, RewardRedemption } from '@/types/orbit';
import type { RewardLedgerEntry, RewardLedgerOrigin, RewardLedgerStatus } from '@/lib/rewards/ledgers';

function ledgerStatus(status: RewardRedemption['status']): RewardLedgerStatus {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'declined';
  return 'approved';
}

function ledgerOrigin(reward: Reward | undefined, note?: string): RewardLedgerOrigin {
  if (reward?.specialRequest || reward?.origin === 'special-request') return 'requested';
  if (note && /ask|request|special/i.test(note)) return 'requested';
  return 'earned';
}

/** Build history entries from synced redemptions (source of truth across devices). */
export function redemptionsToLedgerEntries(
  redemptions: RewardRedemption[],
  rewards: Reward[],
  opts?: { dismissedIds?: Set<string> | Iterable<string> }
): RewardLedgerEntry[] {
  const dismissed =
    opts?.dismissedIds instanceof Set
      ? opts.dismissedIds
      : new Set(opts?.dismissedIds ?? []);
  const byId = new Map(rewards.map((reward) => [reward.id, reward]));

  return redemptions
    .filter((row) => !dismissed.has(row.id))
    .map((row) => {
      const reward = byId.get(row.rewardId);
      return {
        id: row.id,
        householdId: row.householdId,
        memberId: row.memberId,
        rewardId: row.rewardId,
        rewardName: reward?.title ?? 'Reward',
        origin: ledgerOrigin(reward, row.note),
        status: ledgerStatus(row.status),
        createdAt: row.requestedAt,
        resolvedAt: row.decidedAt,
        note: row.note,
      } satisfies RewardLedgerEntry;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
