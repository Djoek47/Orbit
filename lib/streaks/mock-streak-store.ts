/**
 * Mock in-memory ChildStreak store for Phase 3 foundations.
 * Keeps streak engine state out of the main orbit store until rollover lands.
 */

import {
  redeemStreak as redeemStreakPure,
  type ChildStreak,
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

/**
 * Child-initiated redemption stub.
 * Returns true when the held streak was restored.
 * Does not touch XP — penalty is deferred to week close.
 */
export function redeemChildStreak(childId: string): boolean {
  const current = streaks.get(key(childId));
  if (!current) return false;
  const next = redeemStreakPure(current);
  if (!next) return false;
  streaks.set(key(childId), next);
  return true;
}

/** Test / mock reset. */
export function clearMockStreakStore(): void {
  streaks.clear();
}
