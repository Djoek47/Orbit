import { LATE_XP_PENALTY_RATE } from '@/data/task-presets';
import type { HouseholdTask, TaskDifficulty } from '@/types/orbit';

const WEIGHT_BY_DIFFICULTY: Record<TaskDifficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

/** XP = round(baseXp * weightFactor). Weight defaults from difficulty when unset. */
export function computeTaskXp(baseXp: number, weight?: number, difficulty?: TaskDifficulty): number {
  const factor = weight ?? (difficulty ? WEIGHT_BY_DIFFICULTY[difficulty] : 1);
  return Math.max(1, Math.round(baseXp * factor));
}

export function weightForDifficulty(difficulty: TaskDifficulty): number {
  return WEIGHT_BY_DIFFICULTY[difficulty];
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
 * Award after late check. Returns awarded XP and any penalty applied.
 * Formula: awarded = floor(xp * (1 - LATE_XP_PENALTY_RATE)) when late.
 */
export function resolveCompletionXp(task: HouseholdTask, penaltyRate = LATE_XP_PENALTY_RATE) {
  const late = isTaskLate(task);
  const base = task.xp;
  const penalty = late ? Math.max(0, Math.floor(base * penaltyRate)) : 0;
  const awarded = Math.max(0, base - penalty);
  return { awarded, penalty, late, base };
}
