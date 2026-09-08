import {
  isXpEligible,
  normalizeRewardSettings,
  resolveTaskXpFromHouseholdTask,
  type HouseholdRewardSettings,
} from '@/lib/rewards/reward-mode';
import { calculateAward } from '@/lib/scoring/calculate-award';
import type { HouseholdTask, TaskDifficulty } from '@/types/orbit';

const WEIGHT_BY_DIFFICULTY: Record<TaskDifficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

/** XP = round(baseXp * weightFactor). Weight defaults from difficulty when unset. */
export function computeTaskXp(baseXp: number, weight?: number, difficulty?: TaskDifficulty): number {
  if (baseXp <= 0) return 0;
  const factor = weight ?? (difficulty ? WEIGHT_BY_DIFFICULTY[difficulty] : 1);
  return Math.max(0, Math.round(baseXp * factor));
}

export function weightForDifficulty(difficulty: TaskDifficulty): number {
  return WEIGHT_BY_DIFFICULTY[difficulty];
}

export function isHygieneTask(
  task: Pick<HouseholdTask, 'category' | 'tracking' | 'xp' | 'xpEligible'>
): boolean {
  return !isXpEligible(task);
}

export function isTaskLate(task: HouseholdTask, completedAt: Date = new Date()): boolean {
  if (task.status === 'Overdue') {
    return true;
  }
  if (task.dueAt) {
    return new Date(task.dueAt).getTime() < completedAt.getTime();
  }
  return /overdue/i.test(task.due);
}

/**
 * Award after mode resolution. Snapshots go onto `awardedXp`.
 * Revision D §1.2: late completions earn Late Credit (not full XP).
 * Hygiene never earns Late Credit.
 */
export function resolveCompletionXp(
  task: HouseholdTask,
  settings?: Partial<HouseholdRewardSettings> | null,
  completedAt: Date | string = new Date()
) {
  const rewardSettings = normalizeRewardSettings(settings);
  const base = resolveTaskXpFromHouseholdTask(task, rewardSettings);
  if (base <= 0) {
    return { awarded: 0, penalty: 0, late: false, base: 0, completedLate: false };
  }

  const award = calculateAward(
    {
      xp: base,
      dueAt: task.dueAt,
      xpEligible: isXpEligible(task),
      tracking: task.tracking,
      category: task.category,
    },
    completedAt,
    task.dueAt
  );

  const forgone = award.completedLate ? award.fullXp - award.awardedXp : 0;
  return {
    awarded: award.awardedXp,
    penalty: forgone,
    late: award.completedLate,
    base: award.fullXp,
    completedLate: award.completedLate,
  };
}
