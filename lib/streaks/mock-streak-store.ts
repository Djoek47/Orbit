/**
 * Mock in-memory MemberStreak store — Revision D engine.
 */

import {
  acceptStreakRescue,
  applyDayToStreak,
  declineStreakRescue,
  emptyStreak,
  type DayClass,
  type MemberStreak,
} from '@/lib/streaks/streak-engine';

const streaks = new Map<string, MemberStreak>();

function key(memberId: string): string {
  return memberId;
}

export function getMemberStreak(memberId: string): MemberStreak | undefined {
  return streaks.get(key(memberId));
}

export function setMemberStreak(streak: MemberStreak): void {
  streaks.set(key(streak.memberId), { ...streak, rollingMissDates: [...streak.rollingMissDates] });
}

/** @deprecated alias during Rev D cutover — orbit-store still calls setChildStreak */
export const setChildStreak = setMemberStreak;

export function ensureMemberStreak(memberId: string): MemberStreak {
  const existing = streaks.get(key(memberId));
  if (existing) return existing;
  const fresh = emptyStreak(memberId);
  streaks.set(key(memberId), fresh);
  return fresh;
}

export function syncMemberStreakCurrent(memberId: string, current: number): MemberStreak {
  const existing = ensureMemberStreak(memberId);
  const next: MemberStreak = {
    ...existing,
    current,
    longest: Math.max(existing.longest, current),
  };
  setMemberStreak(next);
  return next;
}

export function applyMemberDayClass(
  memberId: string,
  dayClass: DayClass,
  localDate: string,
  weekToDateGrossXp: number
): MemberStreak {
  const current = ensureMemberStreak(memberId);
  const next = applyDayToStreak(current, dayClass, localDate, weekToDateGrossXp);
  setMemberStreak(next);
  return next;
}

/**
 * Accept rescue after the member presses the confirmation prompt.
 * `confirmedViaPrompt` must be true — required for free first rescue.
 */
export function acceptMemberRescue(
  memberId: string,
  confirmedViaPrompt: boolean
): { streak: MemberStreak; accrual: ReturnType<typeof acceptStreakRescue>['accrual'] } {
  const current = ensureMemberStreak(memberId);
  const result = acceptStreakRescue(current, { confirmedViaPrompt });
  setMemberStreak(result.streak);
  return result;
}

export function declineMemberRescue(memberId: string): MemberStreak {
  const current = ensureMemberStreak(memberId);
  const next = declineStreakRescue(current);
  setMemberStreak(next);
  return next;
}

/** @deprecated use acceptMemberRescue — kept name for store wiring during migration */
export function redeemChildStreak(childId: string): MemberStreak | null {
  const result = acceptMemberRescue(childId, true);
  return result.accrual ? result.streak : null;
}

export function clearMockStreakStore(): void {
  streaks.clear();
}

// Legacy aliases used by older call sites during the Rev D cutover.
export const getChildStreak = getMemberStreak;
export const ensureChildStreak = ensureMemberStreak;
export const syncChildStreakCurrent = syncMemberStreakCurrent;
export const clearMockStreakStoreAlias = clearMockStreakStore;
