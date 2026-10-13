/**
 * Bundle bonus helpers — Revision D uses BUNDLE_BONUS_FULL / BUNDLE_BONUS_LATE.
 */

import { BUNDLE_BONUS_FULL, BUNDLE_BONUS_LATE } from '@/constants/scoring';

/** If any task in the group was completed late, pay late bonus. */
export function bundleBonusXp(anyTaskCompletedLate: boolean): number {
  return anyTaskCompletedLate ? BUNDLE_BONUS_LATE : BUNDLE_BONUS_FULL;
}
