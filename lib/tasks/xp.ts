import { LATE_XP_PENALTY_RATE } from '@/data/task-presets';
import {
  isXpEligible,
  normalizeRewardSettings,
  resolveTaskXpFromHouseholdTask,
  type HouseholdRewardSettings,
} from '@/lib/rewards/reward-mode';
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

export function isTaskLate(task: HouseholdTask): boolean {
  if (task.status === 'Overdue') {
    return true;
  }
  if (task.dueAt) {
    return new Date(task.dueAt).getTime() < Date.now();
  }
  return /overdue/i.test(task.due);
}

/**
 * Award after mode resolution + late check. Snapshots go onto `awardedXp`.
 * Hygiene eligibility is resolved before reward mode (Meritocracy/Equity).
 */
export function resolveCompletionXp(
  task: HouseholdTask,
  settings?: Partial<HouseholdRewardSettings> | null,
  penaltyRate = LATE_XP_PENALTY_RATE
) {
  const late = isTaskLate(task);
  const rewardSettings = normalizeRewardSettings(settings);
  const base = resolveTaskXpFromHouseholdTask(task, rewardSettings);
  if (base <= 0) {
    return { awarded: 0, penalty: 0, late, base: 0 };
  }
  const penalty = late ? Math.max(0, Math.floor(base * penaltyRate)) : 0;
  const awarded = Math.max(0, base - penalty);
  return { awarded, penalty, late, base };
}
