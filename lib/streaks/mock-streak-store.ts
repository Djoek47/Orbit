/**
 * Mock in-memory ChildStreak store for Phase 3 foundations.
 * Keeps streak engine state out of the main orbit store until rollover lands.
 */

import {
  applyStreakTransition,
  redeemStreak as redeemStreakPure,
  type ChildStreak,
  type DayOutcome,
} from '@/lib/streaks/streak-engine';

const streaks = new Map<string, ChildStreak>();

function key(childId: string): string {
  return childId;
}

export function getChildStreak(childId: string): ChildStreak | undefined {
  return streaks.get(key(childId));
}

export function setChildStreak(streak: ChildStreak): void {
  streaks.set(key(streak.childId), { ...streak });
}

export function ensureChildStreak(childId: string): ChildStreak {
  const existing = streaks.get(key(childId));
  if (existing) return existing;
  const fresh: ChildStreak = {
    childId,
    current: 0,
    longest: 0,
    state: 'active',
    lastActiveDate: null,
    brokenOnDate: null,
    redeemableUntil: null,
  };
  streaks.set(key(childId), fresh);
  return fresh;
}

/** Align engine current with the persisted member.streak without changing state. */
export function syncChildStreakCurrent(childId: string, memberStreak: number): ChildStreak {
  const existing = ensureChildStreak(childId);
  const next: ChildStreak = {
    ...existing,
    current: memberStreak,
    longest: Math.max(existing.longest, memberStreak),
  };
  setChildStreak(next);
  return next;
}

/**
 * Apply a day outcome through the Phase 3 engine.
 * Callers should avoid mid-day false breaks — prefer `complete` when 100% today.
 */
export function applyChildDayOutcome(
  childId: string,
  outcome: DayOutcome,
  localDate: string
): ChildStreak {
  const current = ensureChildStreak(childId);
  const next = applyStreakTransition(current, outcome, localDate);
  setChildStreak(next);
  return next;
}

/**
 * Child-initiated redemption stub.
 * Returns the restored streak when successful (null otherwise).
 * Does not touch XP — penalty is deferred to week close.
 */
export function redeemChildStreak(childId: string): ChildStreak | null {
  const current = streaks.get(key(childId));
  if (!current) return null;
  const next = redeemStreakPure(current);
  if (!next) return null;
  streaks.set(key(childId), next);
  return next;
}

/** Test / mock reset. */
export function clearMockStreakStore(): void {
  streaks.clear();
}
