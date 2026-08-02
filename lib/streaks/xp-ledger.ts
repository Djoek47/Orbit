/**
 * In-memory XP ledger helpers for mock mode.
 * Weekly XP is SUM(amount); penalties are negative streak_penalty entries.
 * Enforces at most one streak_penalty per (childId, weekKey).
 */

import type { XpLedgerEntry } from '@/lib/streaks/streak-engine';

let seq = 0;

function nextId(): string {
  seq += 1;
  return `xp_${seq}`;
}

export function createEmptyLedger(): XpLedgerEntry[] {
  return [];
}

export function appendLedgerEntry(
  ledger: XpLedgerEntry[],
  entry: Omit<XpLedgerEntry, 'id'> & { id?: string }
): XpLedgerEntry[] {
  if (entry.type === 'streak_penalty') {
    const existing = ledger.find(
      (e) =>
        e.childId === entry.childId &&
        e.weekKey === entry.weekKey &&
        e.type === 'streak_penalty'
    );
    if (existing) {
      // Idempotent: do not write a second penalty for the same week.
      return ledger;
    }
  }

  const full: XpLedgerEntry = {
    id: entry.id ?? nextId(),
    childId: entry.childId,
    weekKey: entry.weekKey,
    type: entry.type,
    amount: entry.amount,
    sourceId: entry.sourceId ?? null,
    occurredAt: entry.occurredAt,
  };
  return [...ledger, full];
}

/** Sum positive award amounts for a child in a week (gross XP). */
export function sumGrossAwards(
  ledger: XpLedgerEntry[],
  childId: string,
  weekKey: string
): number {
  return ledger
    .filter((e) => e.childId === childId && e.weekKey === weekKey && e.type === 'award')
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Sum all ledger amounts (net) for a child in a week. */
export function sumNetWeek(
  ledger: XpLedgerEntry[],
  childId: string,
  weekKey: string
): number {
  return ledger
    .filter((e) => e.childId === childId && e.weekKey === weekKey)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function hasStreakPenalty(
  ledger: XpLedgerEntry[],
  childId: string,
  weekKey: string
): boolean {
  return ledger.some(
    (e) =>
      e.childId === childId && e.weekKey === weekKey && e.type === 'streak_penalty'
  );
}

/**
 * Apply week-close penalty once. Returns unchanged ledger if already applied
 * or if deducted would be 0.
 */
export function applyWeekClosePenalty(
  ledger: XpLedgerEntry[],
  input: {
    childId: string;
    weekKey: string;
    grossXp: number;
    rate: number;
    occurredAt: string;
  }
): XpLedgerEntry[] {
  if (hasStreakPenalty(ledger, input.childId, input.weekKey)) {
    return ledger;
  }
  const deducted = Math.round(Math.max(0, input.grossXp) * input.rate);
  if (deducted <= 0) return ledger;
  return appendLedgerEntry(ledger, {
    childId: input.childId,
    weekKey: input.weekKey,
    type: 'streak_penalty',
    amount: -deducted,
    sourceId: null,
    occurredAt: input.occurredAt,
  });
}

/** Reset helper for tests / mock mode. */
export function resetLedgerIdSeq(): void {
  seq = 0;
}
