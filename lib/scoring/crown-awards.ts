/**
 * Crown award persistence helpers — Revision D §2.4.
 */

import type { CrownAwardResult, CrownType } from '@/lib/scoring/crowns';

export type CrownAward = {
  id: string;
  memberId: string;
  crownType: CrownType;
  periodKey: string;
  netXp: number;
  rank: number;
  tied: boolean;
  awardedAt: string;
};

let crownSeq = 0;

export function resetCrownIdSeq(): void {
  crownSeq = 0;
}

/**
 * Persist medals for ranks 1–3 when a crown was awarded.
 * Zero-XP weeks produce no rows.
 */
export function awardsFromResult(input: {
  result: CrownAwardResult;
  crownType: CrownType;
  periodKey: string;
  awardedAt: string;
}): CrownAward[] {
  if (!input.result.crownAwarded) return [];
  return input.result.rows
    .filter((r) => r.rank != null && r.rank <= 3 && r.medal != null)
    .map((r) => {
      crownSeq += 1;
      return {
        id: `crown_${crownSeq}`,
        memberId: r.memberId,
        crownType: input.crownType,
        periodKey: input.periodKey,
        netXp: r.netXp,
        rank: r.rank!,
        tied: r.tied,
        awardedAt: input.awardedAt,
      };
    });
}

export function crownTallyLabel(awards: CrownAward[], memberId: string): string {
  const mine = awards.filter((a) => a.memberId === memberId && a.rank === 1);
  const weekly = mine.filter((a) => a.crownType === 'weekly').length;
  const monthly = mine.filter((a) => a.crownType === 'monthly').length;
  return `${weekly} weekly crowns · ${monthly} monthly`;
}
