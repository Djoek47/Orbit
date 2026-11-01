/**
 * ChoreMaxx streak engine — Revision D §1.4–§1.5 + monthly Rescue token (Master Brief Q2).
 *
 * DELETED (Rev D §0.2): single-miss break, 15%/30%/50% redemption ladder.
 * Cliffs: 3 consecutive misses OR 3 misses in a rolling 7-day window.
 * Rescue: 10% of week's gross XP per rescued day, max 2 consecutive days.
 * Monthly token: 1 free Rescue per member per calendar month (not lifetime first-free).
 */

import {
  MAX_RESCUABLE_CONSECUTIVE_DAYS,
  MONTHLY_RESCUE_TOKENS,
  RESCUE_COST_PCT_PER_DAY,
  ROLLING_MISS_LIMIT,
  ROLLING_MISS_WINDOW_DAYS,
  WEEK_STARTS_ON,
} from '@/constants/scoring';
import { classifyDay, type DayClass, type QualifyingOccurrence } from '@/lib/scoring/classify-day';
import { addLocalDays } from '@/lib/streaks/local-date';

export type StreakEndedReason = 'consecutive' | 'rolling';

export type MemberStreak = {
  memberId: string;
  current: number;
  longest: number;
  /** Consecutive missed days (skips neutral/recess). */
  consecutiveMissedDays: number;
  /** Local dates classified 'missed' inside the rolling window. */
  rollingMissDates: string[];
  streakEndedAt: string | null;
  streakEndedReason: StreakEndedReason | null;
  /**
   * @deprecated Lifetime free-first flag. Prefer rescueTokensRemaining.
   * Kept so older persisted state still loads; monthly token is authoritative.
   */
  freeRescueUsed: boolean;
  /** Calendar month (YYYY-MM) the token balance applies to. */
  rescueTokenMonth: string | null;
  /** Remaining free Rescue tokens this month. */
  rescueTokensRemaining: number;
  /** Pending rescue offer for the most recent miss (not yet accepted/declined). */
  pendingRescue: PendingRescue | null;
};

export type PendingRescue = {
  missedDate: string;
  /** Offered at this rollover local date. */
  offeredOn: string;
  /** Expires at next 00:00 rollover (local date). */
  expiresOn: string;
  /** Percentage owed against the week that missedDate falls in. */
  pctOwed: number;
  /** Absolute estimate shown in UI (week-to-date gross × pct). */
  estimatedXpCost: number;
  /** True when a monthly Rescue token is available. */
  freeEligible: boolean;
};

export type RescueDecision = 'accepted' | 'declined';

export type WeekRescueAccrual = {
  memberId: string;
  weekKey: string;
  /** Sum of per-day rescue percentages owed this week (0.10 or 0.20 typically). */
  totalRescuePct: number;
  rescuedDates: string[];
};

export type { DayClass, QualifyingOccurrence };

export function classifyMemberDay(input: {
  onRecess?: boolean;
  occurrences: QualifyingOccurrence[];
}): DayClass {
  return classifyDay(input);
}

/** YYYY-MM from a household-local date string. */
export function monthKeyForLocalDate(localDate: string): string {
  return localDate.slice(0, 7);
}

/** Refresh monthly token balance when the calendar month rolls. */
export function ensureMonthlyRescueTokens(
  streak: MemberStreak,
  localDate: string
): MemberStreak {
  const month = monthKeyForLocalDate(localDate);
  if (streak.rescueTokenMonth === month) {
    return streak;
  }
  return {
    ...streak,
    rescueTokenMonth: month,
    rescueTokensRemaining: MONTHLY_RESCUE_TOKENS,
  };
}

export function emptyStreak(memberId: string): MemberStreak {
  return {
    memberId,
    current: 0,
    longest: 0,
    consecutiveMissedDays: 0,
    rollingMissDates: [],
    streakEndedAt: null,
    streakEndedReason: null,
    freeRescueUsed: false,
    rescueTokenMonth: null,
    rescueTokensRemaining: MONTHLY_RESCUE_TOKENS,
    pendingRescue: null,
  };
}

/** ISO week key Mon-start: YYYY-Www relative to household-local date. */
export function weekKeyForLocalDate(localDate: string, weekStartsOn = WEEK_STARTS_ON): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Shift so weekStartsOn (1=Mon) is start
  const day = date.getUTCDay(); // 0=Sun
  const diff = (day - weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.floor((date.getTime() - yearStart.getTime()) / 86_400_000 / 7) + 1;
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function pruneRolling(dates: string[], asOfLocalDate: string): string[] {
  const cutoff = addLocalDays(asOfLocalDate, -(ROLLING_MISS_WINDOW_DAYS - 1));
  return dates.filter((d) => d >= cutoff && d <= asOfLocalDate);
}

function hitConsecutiveCliff(consecutive: number): boolean {
  return consecutive >= ROLLING_MISS_LIMIT;
}

function hitRollingCliff(rollingMissDates: string[]): boolean {
  return rollingMissDates.length >= ROLLING_MISS_LIMIT;
}

/**
 * Apply one day's classification at 00:00 rollover for the day that just ended.
 * `localDate` = the day being closed.
 */
export function applyDayToStreak(
  streak: MemberStreak,
  dayClass: DayClass,
  localDate: string,
  weekToDateGrossXp: number
): MemberStreak {
  // Expire unanswered rescue from previous day → DECLINE (XP unchanged, streak already at risk).
  let next: MemberStreak = ensureMonthlyRescueTokens(
    { ...streak, rollingMissDates: [...streak.rollingMissDates] },
    localDate
  );
  if (next.pendingRescue && localDate > next.pendingRescue.expiresOn) {
    // Inaction = decline. Streak ends (was held only while offer open for day 1–2).
    // Spec: default DECLINE → streak 0, XP unchanged.
    next = {
      ...next,
      current: 0,
      consecutiveMissedDays: 0,
      pendingRescue: null,
      streakEndedAt: next.pendingRescue.missedDate,
      streakEndedReason: 'consecutive',
    };
  } else if (next.pendingRescue && localDate === next.pendingRescue.expiresOn) {
    // Still on the expiry day boundary handled above via `>`. Keep pending until past.
  }

  if (dayClass === 'neutral' || dayClass === 'recess') {
    // Skipped — neither miss nor reset consecutive. Rolling window ages via prune.
    next.rollingMissDates = pruneRolling(next.rollingMissDates, localDate);
    return next;
  }

  if (dayClass === 'complete') {
    next.consecutiveMissedDays = 0;
    next.rollingMissDates = pruneRolling(next.rollingMissDates, localDate);
    next.pendingRescue = null;
    const current = next.current + 1;
    return {
      ...next,
      current,
      longest: Math.max(next.longest, current),
      streakEndedAt: null,
      streakEndedReason: null,
    };
  }

  // missed
  const consecutive = next.consecutiveMissedDays + 1;
  let rolling = pruneRolling([...next.rollingMissDates, localDate], localDate);
  // dedupe
  rolling = Array.from(new Set(rolling)).sort();

  if (hitConsecutiveCliff(consecutive) || hitRollingCliff(rolling)) {
    const reason: StreakEndedReason = hitConsecutiveCliff(consecutive) ? 'consecutive' : 'rolling';
    // No Rescue at the cliff.
    return {
      ...next,
      current: 0,
      consecutiveMissedDays: consecutive,
      rollingMissDates: rolling,
      pendingRescue: null,
      streakEndedAt: localDate,
      streakEndedReason: reason,
    };
  }

  // Offer rescue for consecutive 1 or 2 — token makes it free this month.
  const freeEligible = next.rescueTokensRemaining > 0;
  const pctOwed = RESCUE_COST_PCT_PER_DAY;
  const estimatedXpCost = freeEligible
    ? 0
    : Math.round(Math.max(0, weekToDateGrossXp) * pctOwed);

  return {
    ...next,
    consecutiveMissedDays: consecutive,
    rollingMissDates: rolling,
    pendingRescue: {
      missedDate: localDate,
      offeredOn: localDate,
      expiresOn: addLocalDays(localDate, 1),
      pctOwed,
      estimatedXpCost,
      freeEligible,
    },
  };
}

/**
 * Accept a Streak Rescue.
 *
 * Token (or XP) rescue requires `confirmedViaPrompt: true` — the child must
 * press the prompt. Silent auto-accept is forbidden.
 *
 * Bridge-not-credit: streak current is preserved (not incremented for the miss).
 * No refund at cliff — caller must not reverse prior accruals.
 */
export function acceptStreakRescue(
  streak: MemberStreak,
  opts: { confirmedViaPrompt: boolean }
): {
  streak: MemberStreak;
  accrual: { weekKey: string; pct: number; missedDate: string; free: boolean } | null;
} {
  if (!streak.pendingRescue) {
    return { streak, accrual: null };
  }
  if (!opts.confirmedViaPrompt) {
    return { streak, accrual: null };
  }

  const offer = streak.pendingRescue;
  const withTokens = ensureMonthlyRescueTokens(streak, offer.missedDate);
  const free = offer.freeEligible && withTokens.rescueTokensRemaining > 0;
  const pct = free ? 0 : offer.pctOwed;
  const weekKey = weekKeyForLocalDate(offer.missedDate);

  // Deliberate: no refund if a later cliff ends the streak after paid rescues.
  // They purchased days of preservation and received them.
  return {
    streak: {
      ...withTokens,
      // Bridge — current unchanged (not credited for the missed day).
      pendingRescue: null,
      rescueTokensRemaining: free
        ? Math.max(0, withTokens.rescueTokensRemaining - 1)
        : withTokens.rescueTokensRemaining,
      freeRescueUsed: free ? true : withTokens.freeRescueUsed,
      streakEndedAt: null,
      streakEndedReason: null,
    },
    accrual: { weekKey, pct, missedDate: offer.missedDate, free },
  };
}

/** Decline rescue → streak goes to 0. XP unchanged. */
export function declineStreakRescue(streak: MemberStreak): MemberStreak {
  if (!streak.pendingRescue) return streak;
  return {
    ...streak,
    current: 0,
    pendingRescue: null,
    consecutiveMissedDays: 0,
    streakEndedAt: streak.pendingRescue.missedDate,
    streakEndedReason: 'consecutive',
  };
}

/** Accrue per-day rescue percentages onto a week bucket. */
export function accrueRescuePct(
  week: WeekRescueAccrual,
  missedDate: string,
  pct: number
): WeekRescueAccrual {
  if (pct <= 0) {
    return {
      ...week,
      rescuedDates: [...week.rescuedDates, missedDate],
    };
  }
  return {
    ...week,
    totalRescuePct: week.totalRescuePct + pct,
    rescuedDates: [...week.rescuedDates, missedDate],
  };
}

/**
 * Week-close settlement: deduction = round(weekGrossXp × totalRescuePct).
 * Returns the absolute XP to deduct (positive number).
 */
export function settleWeekRescueDeduction(weekGrossXp: number, totalRescuePct: number): number {
  return Math.round(Math.max(0, weekGrossXp) * Math.max(0, totalRescuePct));
}

/** Max consecutive days that can still be rescued. */
export function canOfferRescue(consecutiveMissedDays: number): boolean {
  return consecutiveMissedDays >= 1 && consecutiveMissedDays <= MAX_RESCUABLE_CONSECUTIVE_DAYS;
}
