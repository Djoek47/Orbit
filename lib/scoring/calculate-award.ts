/**
 * Late Credit / award XP — Revision D §1.2.
 * XP is awarded the instant Complete is tapped. Snapshot awardedXp; never recompute.
 */

import { LATE_CREDIT } from '@/constants/scoring';

export type AwardTask = {
  /** Full on-time XP (ladder or Equity flat 10). */
  xp: number;
  /** Due instant (ISO). Compared to completedAt. */
  dueAt?: string | null;
  /** Hygiene / streak-tracked tasks never earn Late Credit. */
  xpEligible?: boolean;
  tracking?: 'xp' | 'streak';
  category?: string;
};

export type AwardResult = {
  awardedXp: number;
  completedLate: boolean;
  fullXp: number;
};

function isHygieneLike(task: AwardTask): boolean {
  if (task.xpEligible === false) return true;
  if (task.tracking === 'streak') return true;
  if (task.category === 'Hygiene' || task.category === 'personal_hygiene') return true;
  return false;
}

/**
 * Returns full XP if completedAt <= dueAt, otherwise LATE_CREDIT[task.xp].
 * Hygiene → 0 either way. Unknown ladder values fall back to full XP on time,
 * and Math.max(0, xp - 3) late only if not in the table (should not happen).
 */
export function calculateAward(
  task: AwardTask,
  completedAt: Date | string,
  dueAt?: Date | string | null
): AwardResult {
  const fullXp = Math.max(0, task.xp);
  if (isHygieneLike(task) || fullXp === 0) {
    return { awardedXp: 0, completedLate: false, fullXp: 0 };
  }

  const completed =
    typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
  const dueRaw = dueAt ?? task.dueAt;
  if (!dueRaw) {
    return { awardedXp: fullXp, completedLate: false, fullXp };
  }
  const due = typeof dueRaw === 'string' ? new Date(dueRaw) : dueRaw;

  if (completed.getTime() <= due.getTime()) {
    return { awardedXp: fullXp, completedLate: false, fullXp };
  }

  const late = LATE_CREDIT[fullXp];
  if (typeof late === 'number') {
    return { awardedXp: late, completedLate: true, fullXp };
  }
  // Should not happen — ladder is 5/10/15/20/25/30 only.
  return { awardedXp: fullXp, completedLate: true, fullXp };
}

export function lateCreditFor(fullXp: number): number | undefined {
  return LATE_CREDIT[fullXp];
}
