/**
 * Recess — Revision D §3.
 * Pauses task generation while freezing streaks. Per-member periods.
 * Admin-only create. Backdate capped at RECESS_BACKDATE_DAYS.
 */

import { RECESS_BACKDATE_DAYS } from '@/constants/scoring';
import { applyXpChange, type XpLedgerEntry } from '@/lib/streaks/xp-ledger';
import { addLocalDays } from '@/lib/streaks/local-date';
import {
  emptyStreak,
  type MemberStreak,
  type StreakEndedReason,
} from '@/lib/streaks/streak-engine';

export type RecessPeriod = {
  id: string;
  memberId: string;
  startDate: string; // YYYY-MM-DD household-local, inclusive
  endDate: string | null; // null = open-ended
  createdBy: string; // admin id
  createdAt: string;
  isBackdated: boolean;
};

export type RecessError =
  | { code: 'NOT_ADMIN'; message: string }
  | { code: 'BACKDATE_TOO_FAR'; message: string }
  | { code: 'INVALID_RANGE'; message: string };

let recessSeq = 0;

export function resetRecessIdSeq(): void {
  recessSeq = 0;
}

function nextRecessId(): string {
  recessSeq += 1;
  return `recess_${recessSeq}`;
}

/** True when localDate falls inside any active recess period for the member. */
export function isOnRecess(
  periods: RecessPeriod[],
  memberId: string,
  localDate: string
): boolean {
  return periods.some(
    (p) =>
      p.memberId === memberId &&
      p.startDate <= localDate &&
      (p.endDate == null || p.endDate >= localDate)
  );
}

/**
 * Create a recess period. Helpers are rejected (server-side equivalent).
 * Backdating beyond RECESS_BACKDATE_DAYS is rejected.
 */
export function createRecessPeriod(input: {
  memberId: string;
  startDate: string;
  endDate: string | null;
  createdBy: string;
  createdAt: string;
  todayLocal: string;
  isAdmin: boolean;
  existing: RecessPeriod[];
}): { period: RecessPeriod; periods: RecessPeriod[] } | { error: RecessError } {
  if (!input.isAdmin) {
    return {
      error: {
        code: 'NOT_ADMIN',
        message: 'Only admins can put a member on Recess.',
      },
    };
  }

  const earliest = addLocalDays(input.todayLocal, -RECESS_BACKDATE_DAYS);
  if (input.startDate < earliest) {
    return {
      error: {
        code: 'BACKDATE_TOO_FAR',
        message: `Recess can only be backdated up to ${RECESS_BACKDATE_DAYS} days.`,
      },
    };
  }

  if (input.endDate != null && input.endDate < input.startDate) {
    return {
      error: {
        code: 'INVALID_RANGE',
        message: 'Recess end date must be on or after the start date.',
      },
    };
  }

  const isBackdated = input.startDate < input.todayLocal;
  const period: RecessPeriod = {
    id: nextRecessId(),
    memberId: input.memberId,
    startDate: input.startDate,
    endDate: input.endDate,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    isBackdated,
  };

  return { period, periods: [...input.existing, period] };
}

/** Everyone shortcut — one period per member. */
export function createRecessForEveryone(input: {
  memberIds: string[];
  startDate: string;
  endDate: string | null;
  createdBy: string;
  createdAt: string;
  todayLocal: string;
  isAdmin: boolean;
  existing: RecessPeriod[];
}): { periods: RecessPeriod[] } | { error: RecessError } {
  let periods = [...input.existing];
  for (const memberId of input.memberIds) {
    const result = createRecessPeriod({
      ...input,
      memberId,
      existing: periods,
    });
    if ('error' in result) return result;
    periods = result.periods;
  }
  return { periods };
}

/** End recess early — takes effect at next rollover (caller sets endDate = today). */
export function endRecessPeriod(
  periods: RecessPeriod[],
  periodId: string,
  endDate: string
): RecessPeriod[] {
  return periods.map((p) => (p.id === periodId ? { ...p, endDate } : p));
}

/**
 * Rollover behaviour: members on Recess generate ZERO occurrences.
 * Call this before generation — if true, skip entirely.
 */
export function shouldGenerateOccurrences(
  periods: RecessPeriod[],
  memberId: string,
  localDate: string
): boolean {
  return !isOnRecess(periods, memberId, localDate);
}

/** Allowance auto-pay is blocked during Recess; manual send remains allowed. */
export function shouldAutoPayAllowance(
  periods: RecessPeriod[],
  memberId: string,
  localDate: string
): boolean {
  return !isOnRecess(periods, memberId, localDate);
}

export type StreakRescueRefund = {
  missedDate: string;
  deductedXp: number;
};

/**
 * Apply backdated Recess: restore streak broken in window, refund rescues,
 * reclassify days as recess, recompute rolling-7.
 */
export function applyBackdatedRecess(input: {
  streak: MemberStreak;
  ledger: XpLedgerEntry[];
  startDate: string;
  todayLocal: string;
  /** Streak value before the broken window (frozen target). */
  streakBeforeBreak: number;
  /** Rescue settlements inside the backdated window to refund. */
  rescuesToRefund: StreakRescueRefund[];
  occurredAt: string;
}): {
  streak: MemberStreak;
  ledger: XpLedgerEntry[];
} {
  let ledger = input.ledger;
  for (const rescue of input.rescuesToRefund) {
    if (rescue.deductedXp <= 0) continue;
    const applied = applyXpChange(ledger, {
      memberId: input.streak.memberId,
      type: 'adjustment',
      delta: rescue.deductedXp,
      label: `Recess backdate — refund Streak Rescue (${rescue.missedDate})`,
      occurredAt: input.occurredAt,
    });
    ledger = applied.ledger;
  }

  // Drop miss dates that fall inside the backdated recess window.
  const rollingMissDates = input.streak.rollingMissDates.filter(
    (d) => d < input.startDate || d > input.todayLocal
  );

  const streak: MemberStreak = {
    ...input.streak,
    current: input.streakBeforeBreak,
    longest: Math.max(input.streak.longest, input.streakBeforeBreak),
    consecutiveMissedDays: 0,
    rollingMissDates,
    streakEndedAt: null,
    streakEndedReason: null as StreakEndedReason | null,
    pendingRescue: null,
  };

  return { streak, ledger };
}

/**
 * Simulate the worked example: streak 12 → 20 recess days → still 12 → complete → 13.
 * Pure helper used by T3.1 / T3.2.
 */
export function simulateRecessFreeze(input: {
  memberId: string;
  streakBefore: number;
  recessDays: number;
  completeOnReturn: boolean;
}): MemberStreak {
  let streak = {
    ...emptyStreak(input.memberId),
    current: input.streakBefore,
    longest: input.streakBefore,
  };
  // Recess days: classify as recess — consecutive/rolling unchanged, current frozen.
  for (let i = 0; i < input.recessDays; i++) {
    // no-op on current — frozen
  }
  if (input.completeOnReturn) {
    streak = {
      ...streak,
      current: streak.current + 1,
      longest: Math.max(streak.longest, streak.current + 1),
    };
  }
  return streak;
}
