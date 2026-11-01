/**
 * Crowns — The Week's Crown / Monthly Sovereign — Revision D §2.1–§2.2.
 * Rankings are computed from XpLedgerEntry nets. Competition ranking: 1,1,3,4.
 */

import { CROWN_COLORS } from '@/constants/crown-colors';
import { VOCAB } from '@/constants/vocabulary';
import type { XpLedgerEntry } from '@/lib/streaks/xp-ledger';
import { sumPeriodNet } from '@/lib/streaks/xp-ledger';

export type CrownType = 'weekly' | 'monthly';

export type CrownCompetitor = {
  memberId: string;
  name: string;
  /** True if on Recess for any part of the period — excluded from medals. */
  onRecess: boolean;
  /** Tie-break inputs (display stability only). */
  tasksCompleted: number;
  lateCount: number;
};

export type CrownRankRow = {
  memberId: string;
  name: string;
  netXp: number;
  rank: number | null;
  medal: 'gold' | 'silver' | 'bronze' | null;
  color: string;
  tied: boolean;
  tiedLabel: string | null;
  onRecess: boolean;
  excluded: boolean;
};

export type CrownAwardResult = {
  rows: CrownRankRow[];
  /** False when top has 0 XP — no crown awarded. */
  crownAwarded: boolean;
  emptyCopy: string | null;
};

function medalForRank(rank: number | null): CrownRankRow['medal'] {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

function colorForMedal(medal: CrownRankRow['medal']): string {
  if (medal === 'gold') return CROWN_COLORS.gold;
  if (medal === 'silver') return CROWN_COLORS.silver;
  if (medal === 'bronze') return CROWN_COLORS.bronze;
  return CROWN_COLORS.standard;
}

/**
 * Competition ranking: ties share a rank and consume ranks below.
 * Example: 420,420,310 → ranks 1,1,3 (no silver).
 */
export function competitionRanks(sortedNetXp: number[]): number[] {
  const ranks: number[] = [];
  let i = 0;
  while (i < sortedNetXp.length) {
    const xp = sortedNetXp[i];
    let j = i;
    while (j < sortedNetXp.length && sortedNetXp[j] === xp) j += 1;
    const rank = i + 1;
    for (let k = i; k < j; k++) ranks.push(rank);
    i = j;
  }
  return ranks;
}

function tieBreak(a: CrownCompetitor & { netXp: number }, b: CrownCompetitor & { netXp: number }): number {
  if (b.netXp !== a.netXp) return b.netXp - a.netXp;
  if (b.tasksCompleted !== a.tasksCompleted) return b.tasksCompleted - a.tasksCompleted;
  if (a.lateCount !== b.lateCount) return a.lateCount - b.lateCount; // fewest late wins
  return a.name.localeCompare(b.name);
}

/**
 * Build crown standings for a period from the ledger.
 */
export function rankCrownPeriod(input: {
  ledger: XpLedgerEntry[];
  competitors: CrownCompetitor[];
  fromIso: string;
  toIso: string;
}): CrownAwardResult {
  const scored = input.competitors.map((c) => ({
    ...c,
    netXp: c.onRecess
      ? 0
      : sumPeriodNet(input.ledger, c.memberId, input.fromIso, input.toIso),
  }));

  const active = scored.filter((c) => !c.onRecess);
  const recess = scored.filter((c) => c.onRecess);

  active.sort(tieBreak);
  const ranks = competitionRanks(active.map((c) => c.netXp));

  const topXp = active[0]?.netXp ?? 0;
  const crownAwarded = topXp > 0;

  const activeRows: CrownRankRow[] = active.map((c, i) => {
    const rank = crownAwarded ? ranks[i] : null;
    const medal = crownAwarded ? medalForRank(rank) : null;
    const tied =
      crownAwarded &&
      rank != null &&
      active.filter((_, j) => ranks[j] === rank).length > 1;
    return {
      memberId: c.memberId,
      name: c.name,
      netXp: c.netXp,
      rank,
      medal,
      color: colorForMedal(medal),
      tied,
      tiedLabel: tied && rank === 1 ? VOCAB.tiedFor1st : tied && rank != null ? `Tied for ${rank}` : null,
      onRecess: false,
      excluded: false,
    };
  });

  const recessRows: CrownRankRow[] = recess.map((c) => ({
    memberId: c.memberId,
    name: c.name,
    netXp: c.netXp,
    rank: null,
    medal: null,
    color: CROWN_COLORS.standard,
    tied: false,
    tiedLabel: null,
    onRecess: true,
    excluded: true,
  }));

  return {
    rows: [...activeRows, ...recessRows],
    crownAwarded,
    emptyCopy: crownAwarded ? null : VOCAB.noCrownThisWeek,
  };
}

export type ChampionsRecord = {
  memberId: string;
  name: string;
  rank: number | null;
  medal: CrownRankRow['medal'];
  netXp: number;
  tasksCompleted: number;
  onTimeCount: number;
  currentStreak: number;
  bestDayLabel: string | null;
  busiestDomain: string | null;
  /** Restricted — admins + self only */
  lateCount?: number;
  expiredCount?: number;
  streakRescuesUsed?: number;
};

/**
 * Strip restricted fields for unauthorized viewers (Helpers viewing siblings).
 * Server-side equivalent: omit keys entirely — never zero them.
 */
export function filterChampionsRecord(
  record: ChampionsRecord,
  viewer: { memberId: string; isAdmin: boolean }
): ChampionsRecord {
  const allowed = viewer.isAdmin || viewer.memberId === record.memberId;
  if (allowed) return { ...record };
  const {
    lateCount: _l,
    expiredCount: _e,
    streakRescuesUsed: _r,
    ...publicFields
  } = record;
  return publicFields;
}
