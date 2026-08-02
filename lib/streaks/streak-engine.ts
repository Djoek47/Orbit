/**
 * Choremaxx streak engine — pure foundations (Phase 3).
 *
 * All dates are household-local `YYYY-MM-DD` strings (`localDate`).
 * Decisions locked in docs/logic/choremaxx-streak-engine-cursor-spec.md §1.
 */

import { addLocalDays } from '@/lib/streaks/local-date';

// ── Types ──────────────────────────────────────────────────────────────

export type StreakState = 'active' | 'broken_redeemable' | 'broken_final';

export type DayOutcome = 'complete' | 'partial' | 'missed' | 'neutral';

export interface ChildDay {
  childId: string;
  /** YYYY-MM-DD, household-local */
  localDate: string;
  /** Chores due this day (hygiene excluded) */
  tasksDue: number;
  tasksCompleted: number;
  /** null = not yet rolled over */
  outcome: DayOutcome | null;
  evaluatedAt: string | null;
}

export interface ChildStreak {
  childId: string;
  current: number;
  longest: number;
  state: StreakState;
  /** Last date that counted toward the streak */
  lastActiveDate: string | null;
  brokenOnDate: string | null;
  /** localDate — end of the day after the break */
  redeemableUntil: string | null;
}

export interface WeeklyPenalty {
  childId: string;
  /** YYYY-Www, household-local, respects weekStartsOn */
  weekKey: string;
  /** 0, 1, 2, 3+ */
  redemptionCount: number;
  /** 0 | 0.15 | 0.30 | 0.50 — derived, stored for audit */
  penaltyRate: number;
  /** Set at week close; null while week is open */
  appliedAt: string | null;
  grossXpAtApply: number | null;
  deductedXp: number | null;
}

export interface HouseholdDay {
  householdId: string;
  localDate: string;
  /** Across all members */
  tasksDue: number;
  tasksCompleted: number;
  /** When it first hit 100% — null if never */
  completedAt: string | null;
  celebrationFiredAt: string | null;
}

export interface XpLedgerEntry {
  id: string;
  childId: string;
  weekKey: string;
  type: 'award' | 'streak_penalty' | 'adjustment';
  /** Signed — penalties are negative */
  amount: number;
  /** Completion id, redemption id */
  sourceId: string | null;
  occurredAt: string;
}

export const MAX_PENALTY_RATE = 0.5;

// ── Penalty ladder (tiered replacement, not additive) ──────────────────

/**
 * Tiered redemption penalty rate.
 * 0 → 0, 1 → 15%, 2 → 30%, 3+ → 50% (hard ceiling).
 */
export function penaltyRateFor(redemptionCount: number): number {
  if (redemptionCount <= 0) return 0;
  if (redemptionCount === 1) return 0.15;
  if (redemptionCount === 2) return 0.3;
  return MAX_PENALTY_RATE;
}

// ── Day classification ─────────────────────────────────────────────────

/**
 * Classify a child-day at rollover.
 * Hygiene must already be excluded from tasksDue / tasksCompleted.
 */
export function classifyChildDay(input: {
  tasksDue: number;
  tasksCompleted: number;
}): DayOutcome {
  const { tasksDue, tasksCompleted } = input;
  if (tasksDue === 0) return 'neutral';
  if (tasksCompleted === tasksDue) return 'complete';
  if (tasksCompleted === 0) return 'missed';
  return 'partial';
}

// ── Streak state machine ───────────────────────────────────────────────

function withLongest(streak: ChildStreak, current: number): number {
  return Math.max(streak.longest, current);
}

/**
 * Apply one day's outcome to a ChildStreak.
 * `localDate` is the closing household-local YYYY-MM-DD being evaluated.
 *
 * - neutral: preserve current (do not increment)
 * - complete: current += 1 (only while active / after broken_final)
 * - partial / missed: break → broken_redeemable, hold current, redeemableUntil = next day
 *
 * While `broken_redeemable`, complete/neutral leave the held streak alone until
 * redeem or window expiry. Expires when localDate > redeemableUntil.
 */
export function applyStreakTransition(
  streak: ChildStreak,
  outcome: DayOutcome,
  localDate: string
): ChildStreak {
  let next: ChildStreak = { ...streak };

  // Expire redemption window before applying today's outcome.
  if (
    next.state === 'broken_redeemable' &&
    next.redeemableUntil != null &&
    localDate > next.redeemableUntil
  ) {
    next = {
      ...next,
      current: 0,
      state: 'broken_final',
      brokenOnDate: null,
      redeemableUntil: null,
    };
  }

  // Still within redemption window: only a fresh break refreshes the window.
  // complete/neutral do not touch the held current (must redeem explicitly).
  if (next.state === 'broken_redeemable') {
    if (outcome === 'partial' || outcome === 'missed') {
      return {
        ...next,
        brokenOnDate: localDate,
        redeemableUntil: addLocalDays(localDate, 1),
      };
    }
    return next;
  }

  if (outcome === 'neutral') {
    // Preserve — current and lastActiveDate unchanged.
    if (next.state === 'broken_final') {
      return { ...next, state: 'active' };
    }
    return next;
  }

  if (outcome === 'complete') {
    // broken_final (or post-expiry) accrues from 0 → 1.
    const base = next.state === 'broken_final' ? 0 : next.current;
    const current = base + 1;
    return {
      ...next,
      current,
      longest: withLongest(next, current),
      state: 'active',
      lastActiveDate: localDate,
      brokenOnDate: null,
      redeemableUntil: null,
    };
  }

  // partial or missed → break. Hold current for redemption (do not zero yet).
  return {
    ...next,
    state: 'broken_redeemable',
    brokenOnDate: localDate,
    redeemableUntil: addLocalDays(localDate, 1),
  };
}

/**
 * Child-initiated streak redemption. Restores the held current value.
 * Caller must increment WeeklyPenalty.redemptionCount and enforce gates
 * (state, redeemableUntil, approval). Pure — does not touch XP.
 */
export function redeemStreak(streak: ChildStreak): ChildStreak | null {
  if (streak.state !== 'broken_redeemable') return null;
  return {
    ...streak,
    state: 'active',
    brokenOnDate: null,
    redeemableUntil: null,
    longest: withLongest(streak, streak.current),
  };
}

// ── Weekly penalty projection ──────────────────────────────────────────

export interface WeekPenaltyProjection {
  rate: number;
  deducted: number;
  net: number;
}

/**
 * Project week-close penalty against gross XP.
 * Uses Math.round. Net is never negative.
 */
export function projectWeekPenalty(input: {
  grossXp: number;
  redemptionCount: number;
}): WeekPenaltyProjection {
  const rate = penaltyRateFor(input.redemptionCount);
  const gross = Math.max(0, input.grossXp);
  const deducted = Math.round(gross * rate);
  const net = Math.max(0, gross - deducted);
  return { rate, deducted, net };
}

// ── Household completion ───────────────────────────────────────────────

/**
 * Household completion percentage.
 * Returns null when nothing is due (empty/rest day — never celebrate 100%).
 */
export function householdCompletionPct(day: Pick<HouseholdDay, 'tasksDue' | 'tasksCompleted'>): number | null {
  if (day.tasksDue === 0) return null;
  return Math.floor((day.tasksCompleted / day.tasksDue) * 100);
}
