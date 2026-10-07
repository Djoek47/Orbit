/**
 * Revision F §4 — Hold & Request day-completion gate.
 */

import { formatLocalDate } from '@/lib/streaks/local-date';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import { taskMatchesAssignee } from '@/lib/tasks/split-assign';
import { isCompletedToday, isDueToday, isDueTodayLabel } from '@/lib/tasks/today';
import type { HouseholdTask } from '@/types/orbit';

export type RewardRequestGate = {
  allowed: boolean;
  remaining: {
    tasks: number;
    homework: number;
  };
};

function isHomeworkTask(task: HouseholdTask): boolean {
  return (
    task.category === 'homework_education' ||
    /homework/i.test(task.category) ||
    /homework/i.test(task.title)
  );
}

/** Qualifying frequencies for the gate (Rev F §4.2). */
export function isQualifyingForRewardGate(task: HouseholdTask): boolean {
  if (isHomeworkTask(task) && isDueToday(task)) return true;
  const repeat = task.repeat;
  return repeat === 'Daily' || repeat === 'Weekdays';
}

function isOpenBlocking(task: HouseholdTask): boolean {
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  // Expired blocks for the rest of the day (cannot be completed).
  if (isExpiredStatus(task.status)) return true;
  return (
    task.status === 'Pending' ||
    task.status === 'In Progress' ||
    task.status === 'Overdue'
  );
}

/**
 * A Sidekick may request a reward only when every assigned task and homework
 * due today is complete (Revision G §7.3). Late Credit completions count.
 * Expired items keep the gate closed.
 *
 * // TODO(product): Should a Sidekick with zero assigned items be able to ask
 * for a reward? Default shipped: No — gate closed.
 */
export function canRequestReward(
  memberName: string,
  tasks: HouseholdTask[],
  _now = new Date()
): RewardRequestGate {
  const mine = tasks.filter(
    (t) => taskMatchesAssignee(t, memberName) && t.status !== 'Cancelled'
  );

  const qualifying = mine.filter((t) => {
    if (!isQualifyingForRewardGate(t)) return false;
    // Include today's expired occurrences (they block).
    if (isExpiredStatus(t.status)) {
      const day = t.occurrenceDate || (t.expiredAt ? formatLocalDate(new Date(t.expiredAt)) : null);
      const today = formatLocalDate(_now);
      return !day || day === today || isDueToday(t);
    }
    if (t.status === 'Completed') {
      // Finished today still counts as the day's work (Late Credit included).
      return (
        isCompletedToday(t, _now) ||
        isDueTodayLabel(t.due) ||
        t.occurrenceDate === formatLocalDate(_now)
      );
    }
    return isDueToday(t) || t.occurrenceDate === formatLocalDate(_now);
  });

  let tasksLeft = 0;
  let homeworkLeft = 0;
  for (const task of qualifying) {
    if (!isOpenBlocking(task)) continue;
    if (isHomeworkTask(task)) homeworkLeft += 1;
    else tasksLeft += 1;
  }

  return {
    allowed: qualifying.length > 0 && tasksLeft === 0 && homeworkLeft === 0,
    remaining: { tasks: tasksLeft, homework: homeworkLeft },
  };
}

/** Exact blocked copy lines (Rev F §4.4) — omit zero counts. */
export function blockedRequestCopy(gate: RewardRequestGate): {
  title: string;
  body: string;
  lines: string[];
  cta: string;
} {
  const lines: string[] = [];
  if (gate.remaining.tasks > 0) {
    lines.push(
      gate.remaining.tasks === 1
        ? '1 task left'
        : `${gate.remaining.tasks} tasks left`
    );
  }
  if (gate.remaining.homework > 0) {
    lines.push(
      gate.remaining.homework === 1
        ? '1 homework left'
        : `${gate.remaining.homework} homework left`
    );
  }
  return {
    title: 'Not just yet',
    body: "Finish today's tasks and homework to ask for a reward.",
    lines,
    cta: "See what's left",
  };
}

/**
 * Rate limit: once per reward frequency period (Rev F §4.5).
 * `lastRequestedAt` ISO; frequency from reward catalogue.
 */
export function canRequestRewardAgain(input: {
  frequency: 'Daily' | 'Weekly' | 'Monthly' | string;
  lastRequestedAt?: string | null;
  now?: Date;
}): boolean {
  if (!input.lastRequestedAt) return true;
  const now = input.now ?? new Date();
  const last = new Date(input.lastRequestedAt);
  if (Number.isNaN(last.getTime())) return true;
  const freq = input.frequency.toLowerCase();
  if (freq === 'daily') {
    return formatLocalDate(last) !== formatLocalDate(now);
  }
  if (freq === 'weekly') {
    // Monday-start week (Rev D WEEK_STARTS_ON).
    const weekKey = (d: Date) => {
      const copy = new Date(d);
      const day = (copy.getDay() + 6) % 7; // Mon=0
      copy.setDate(copy.getDate() - day);
      return formatLocalDate(copy);
    };
    return weekKey(last) !== weekKey(now);
  }
  if (freq === 'monthly') {
    return (
      last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth()
    );
  }
  // Default: daily period
  return formatLocalDate(last) !== formatLocalDate(now);
}
