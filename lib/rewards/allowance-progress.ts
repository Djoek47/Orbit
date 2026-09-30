/**
 * Revision F §11.3 — allowance period progress (same qualifying set as reward gate).
 */

import { canRequestReward, isQualifyingForRewardGate } from '@/lib/rewards/can-request-reward';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import { taskMatchesAssignee } from '@/lib/tasks/split-assign';
import type { HouseholdTask } from '@/types/orbit';

export type AllowanceFrequency = 'daily' | 'weekly' | 'monthly';

export type AllowanceRule = {
  id: string;
  householdId: string;
  memberId: string;
  memberName: string;
  amount: number;
  currency: string;
  frequency: AllowanceFrequency;
  active: boolean;
  createdAt: string;
};

export type AllowanceProgress = {
  completed: number;
  total: number;
  ratio: number;
  earned: boolean;
  label: string;
  helper: string;
};

function weekStartKey(d: Date): string {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Mon=0
  copy.setDate(copy.getDate() - day);
  return formatLocalDate(copy);
}

function inCurrentPeriod(
  task: HouseholdTask,
  frequency: AllowanceFrequency,
  now: Date
): boolean {
  const key =
    task.occurrenceDate ||
    (task.dueAt ? formatLocalDate(new Date(task.dueAt)) : formatLocalDate(now));
  if (frequency === 'daily') return key === formatLocalDate(now);
  if (frequency === 'weekly') {
    return weekStartKey(new Date(`${key}T12:00:00`)) === weekStartKey(now);
  }
  const [y, m] = key.split('-').map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1;
}

export function allowanceProgressForMember(input: {
  memberName: string;
  frequency: AllowanceFrequency;
  tasks: HouseholdTask[];
  now?: Date;
}): AllowanceProgress {
  const now = input.now ?? new Date();
  const mine = input.tasks.filter(
    (t) =>
      taskMatchesAssignee(t, input.memberName) &&
      t.status !== 'Cancelled' &&
      isQualifyingForRewardGate(t) &&
      inCurrentPeriod(t, input.frequency, now)
  );
  const total = mine.length;
  const completed = mine.filter((t) => t.status === 'Completed').length;
  const ratio = total === 0 ? 1 : completed / total;
  const earned = total === 0 ? false : completed === total && !mine.some((t) => isExpiredStatus(t.status));
  const periodWord =
    input.frequency === 'daily' ? 'day' : input.frequency === 'weekly' ? 'week' : 'month';

  if (total === 0) {
    return {
      completed: 0,
      total: 0,
      ratio: 0,
      earned: false,
      label: `0 of 0 tasks`,
      helper: `No qualifying tasks this ${periodWord}`,
    };
  }

  // Vacuous gate for reward ≠ allowance earn; allowance needs work in the period.
  void canRequestReward;

  return {
    completed,
    total,
    ratio,
    earned,
    label: `${completed} of ${total} tasks`,
    helper: earned
      ? `Earned when the ${periodWord} is finished`
      : mine.some((t) => isExpiredStatus(t.status))
        ? `Not earned this ${periodWord}`
        : `Earned when the ${periodWord} is finished`,
  };
}

/** All-or-nothing at period close — Rev F §11.4. */
export function shouldOweAllowance(progress: AllowanceProgress): boolean {
  return progress.total > 0 && progress.earned && progress.ratio === 1;
}
