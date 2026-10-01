/**
 * One state per task, decided in one place.
 *
 * The task page read the clock twice: the stored `status` painted one chip, and `isTaskLate()`
 * painted another beside it. They disagreed, which is how a task came to read
 *
 *   "Pending · Late"    — is it still mine to do, or is it gone?
 *   "Expired · Late"    — expired work cannot also be running late
 *
 * A task is in exactly one state. "Late" is never a state of its own: before the deadline it is
 * **due**, after the deadline but before the day closes it is **overdue** (still finishable, for
 * less XP), and once the day closes it is **expired** (finished with). Late Credit is a separate
 * idea that only applies to work already **done** — it says how the XP was earned, not where the
 * task stands.
 *
 * Pure: no React Native, no storage. The page renders what this returns.
 */
import { isLateWindow } from '@/lib/tasks/occurrence-status';
import type { HouseholdTask } from '@/types/orbit';

export type TaskState =
  /** Not due yet. */
  | 'upcoming'
  /** Due today, deadline not passed. */
  | 'due'
  /** Past the deadline, before the day closes — still finishable, for less XP. */
  | 'overdue'
  /** Done on time. */
  | 'done'
  /** Done after the deadline — earned Late Credit. */
  | 'done-late'
  /** The day closed on it. Terminal. */
  | 'expired'
  /** Skipped for today, or cancelled. Terminal. */
  | 'skipped';

export type TaskStateView = {
  state: TaskState;
  /** The one chip's words. */
  label: string;
  /** 'neutral' | 'live' | 'warn' | 'good' | 'gone' — the page maps these to its palette. */
  tone: 'neutral' | 'live' | 'warn' | 'good' | 'gone';
  /** True while the task can still be finished. */
  open: boolean;
  /** True when nothing more will happen to it. */
  terminal: boolean;
};

const TERMINAL: TaskState[] = ['done', 'done-late', 'expired', 'skipped'];

/** The one reading. Everything on screen comes from this. */
export function taskState(task: HouseholdTask, now = new Date()): TaskState {
  if (task.status === 'Completed') {
    return task.completedLate ? 'done-late' : 'done';
  }
  if (task.status === 'Cancelled') return 'skipped';
  // 'Missed' is the old name for the same thing.
  if (task.status === 'Expired' || task.status === 'Missed') return 'expired';

  // Still open. The clock decides between upcoming, due and overdue — never "late" beside
  // another state.
  if (task.status === 'Overdue') return 'overdue';
  if (task.dueAt) {
    const due = new Date(task.dueAt).getTime();
    if (!Number.isNaN(due) && now.getTime() > due) {
      // Past the deadline but still today: finishable, for less. Past that, the day's close
      // expires it — the boundary pass stamps the status, and until it runs we still say
      // overdue rather than inventing a state the data doesn't have.
      return 'overdue';
    }
    return 'due';
  }
  if (/overdue/i.test(task.due ?? '')) return 'overdue';
  if (/today|tonight/i.test(task.due ?? '')) return 'due';
  return 'upcoming';
}

const VIEWS: Record<TaskState, Omit<TaskStateView, 'state'>> = {
  upcoming: { label: 'Upcoming', tone: 'neutral', open: true, terminal: false },
  due: { label: 'Due today', tone: 'live', open: true, terminal: false },
  overdue: { label: 'Overdue', tone: 'warn', open: true, terminal: false },
  done: { label: 'Done', tone: 'good', open: false, terminal: true },
  'done-late': { label: 'Done late', tone: 'warn', open: false, terminal: true },
  expired: { label: 'Expired', tone: 'gone', open: false, terminal: true },
  skipped: { label: 'Skipped', tone: 'gone', open: false, terminal: true },
};

export function taskStateView(task: HouseholdTask, now = new Date()): TaskStateView {
  const state = taskState(task, now);
  return { state, ...VIEWS[state] };
}

/** True while finishing it is still possible — one answer, used by every button. */
export function canFinishTask(task: HouseholdTask, now = new Date()): boolean {
  return !TERMINAL.includes(taskState(task, now));
}

/**
 * Would finishing it right now earn Late Credit rather than full XP? Only meaningful while the
 * task is still open; a finished task already carries `completedLate`.
 */
export function wouldEarnLateCredit(task: HouseholdTask, now = new Date()): boolean {
  return taskState(task, now) === 'overdue' && isLateWindow(task.dueAt, now);
}
