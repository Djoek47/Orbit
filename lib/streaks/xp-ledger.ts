/**
 * XP Ledger — Revision D §1.6.
 * Every XP mutation routes through applyXpChange(). No silent balance edits.
 */

export type XpLedgerType =
  | 'task_completed'
  | 'late_credit'
  | 'bundle_bonus'
  | 'streak_rescue'
  | 'reversal'
  | 'adjustment';

export type XpLedgerEntry = {
  id: string;
  memberId: string;
  occurredAt: string; // ISO UTC
  type: XpLedgerType;
  /** Signed. −26 for a rescue. */
  delta: number;
  balanceAfter: number;
  /** Human-readable, kid-appropriate. */
  label: string;
  occurrenceId?: string;
  weekKey?: string;
};

let seq = 0;

export function resetLedgerIdSeq(): void {
  seq = 0;
}

function nextId(): string {
  seq += 1;
  return `xpl_${seq}`;
}

export function createEmptyLedger(): XpLedgerEntry[] {
  return [];
}

export function balanceOf(ledger: XpLedgerEntry[], memberId: string): number {
  for (let i = ledger.length - 1; i >= 0; i--) {
    if (ledger[i].memberId === memberId) return ledger[i].balanceAfter;
  }
  return 0;
}

/**
 * Single write path for all XP mutations.
 * Returns the new ledger and the entry written.
 */
export function applyXpChange(
  ledger: XpLedgerEntry[],
  input: {
    memberId: string;
    type: XpLedgerType;
    delta: number;
    label: string;
    occurredAt: string;
    occurrenceId?: string;
    weekKey?: string;
  }
): { ledger: XpLedgerEntry[]; entry: XpLedgerEntry } {
  const prev = balanceOf(ledger, input.memberId);
  const balanceAfter = prev + input.delta;
  const entry: XpLedgerEntry = {
    id: nextId(),
    memberId: input.memberId,
    occurredAt: input.occurredAt,
    type: input.type,
    delta: input.delta,
    balanceAfter,
    label: input.label,
    occurrenceId: input.occurrenceId,
    weekKey: input.weekKey,
  };
  return { ledger: [...ledger, entry], entry };
}

/** Gross XP for a week = sum of positive task_completed + late_credit + bundle_bonus. */
export function sumWeekGross(
  ledger: XpLedgerEntry[],
  memberId: string,
  weekKey: string
): number {
  return ledger
    .filter(
      (e) =>
        e.memberId === memberId &&
        e.weekKey === weekKey &&
        e.delta > 0 &&
        (e.type === 'task_completed' || e.type === 'late_credit' || e.type === 'bundle_bonus')
    )
    .reduce((sum, e) => sum + e.delta, 0);
}

/** Net XP for a period (all types). */
export function sumPeriodNet(
  ledger: XpLedgerEntry[],
  memberId: string,
  fromIso: string,
  toIso: string
): number {
  return ledger
    .filter(
      (e) =>
        e.memberId === memberId && e.occurredAt >= fromIso && e.occurredAt <= toIso
    )
    .reduce((sum, e) => sum + e.delta, 0);
}

export function entriesForWeek(
  ledger: XpLedgerEntry[],
  memberId: string,
  weekKey: string
): XpLedgerEntry[] {
  return ledger.filter((e) => e.memberId === memberId && e.weekKey === weekKey);
}
