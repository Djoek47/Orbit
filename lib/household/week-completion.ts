/**
 * The household's completion score, from the jobs that actually came due.
 *
 * It was "finished ÷ every task ever created": skipped jobs, long-expired ones and next week's
 * all sat in the bottom of the fraction, so the score said little. Now:
 *
 *   window   the last 7 days on this device's calendar, today included
 *   done     jobs in the window that were finished
 *   missed   jobs in the window whose day closed without being finished
 *   score    done ÷ (done + missed) — jobs still finishable today don't count against anyone yet
 *   open     jobs that can still be finished right now (any day)
 *
 * Pure: no React Native, no storage.
 */
import { taskState } from '@/lib/tasks/task-state';
import type { HouseholdTask } from '@/types/orbit';

export type WeekCompletion = {
  score: number | null;
  done: number;
  missed: number;
  open: number;
  /** Open jobs past their time today (still finishable, for less). */
  overdue: number;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function taskDay(task: HouseholdTask): string | null {
  if (task.occurrenceDate) return task.occurrenceDate;
  const iso = task.dueAt ?? (task.status === 'Completed' ? task.completedAt : undefined);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

export function weekCompletion(tasks: HouseholdTask[], now = new Date()): WeekCompletion {
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const from = dayKey(start);
  const to = dayKey(now);
  let done = 0;
  let missed = 0;
  let open = 0;
  let overdue = 0;
  for (const task of tasks) {
    const state = taskState(task, now);
    if (state === 'upcoming' || state === 'due' || state === 'overdue') {
      open += 1;
      if (state === 'overdue') overdue += 1;
      continue;
    }
    const day = taskDay(task);
    if (!day || day < from || day > to) continue;
    if (state === 'done' || state === 'done-late') done += 1;
    else if (state === 'expired') missed += 1;
  }
  const judged = done + missed;
  return { score: judged ? Math.round((done / judged) * 100) : null, done, missed, open, overdue };
}
