/**
 * Smart admin reassignment — product decisions (make-v32 logic audit §13).
 *
 * - Expired: never revive (new assign only).
 * - Series handoff: this occurrence only.
 * - Grace: new assignee gets full XP the night of reassign AND the next day
 *   until that day's household deadline. Late Credit only if late on day 2.
 * - If unfinished the night of reassign → carry to next day (do not expire
 *   against them); copy: reassigned yesterday, still full XP window.
 * - Previous assignee drops out of the streak denominator (no miss).
 */
import { resolveAssignOccurrence } from '@/lib/tasks/assign-occurrence';
import {
  addCalendarDays,
  formatDateInTimezone,
  isPastDailyDeadline,
  resolveHouseholdTimezone,
  wallTimeToUtc,
} from '@/lib/tasks/household-tz';
import { canFinishTask, taskState } from '@/lib/tasks/task-state';
import type { HouseholdTask } from '@/types/orbit';

export type ReassignMode = 'same_day_grace' | 'next_day_grace';

export type ReassignPlanOk = {
  ok: true;
  mode: ReassignMode;
  previousAssignee: string;
  nextAssignee: string;
  dropsFromPreviousDenominator: true;
  doesNotMissNewAssignee: true;
  /** Series: never rewrite future days from a handoff. */
  seriesScope: 'this';
  patch: Partial<HouseholdTask>;
  summary: string;
};

export type ReassignPlanBlocked = {
  ok: false;
  reason: 'not_open' | 'same_assignee' | 'empty_assignee' | 'expired' | 'completed' | 'skipped';
  message: string;
};

export type ReassignPlan = ReassignPlanOk | ReassignPlanBlocked;

export type PlanReassignInput = {
  task: HouseholdTask;
  newAssigneeName: string;
  dailyDeadlineHm: string;
  timezone?: string | null;
  now?: Date;
};

export function planTaskReassignment(input: PlanReassignInput): ReassignPlan {
  const trimmed = input.newAssigneeName.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty_assignee', message: 'Pick someone to give this to.' };
  }
  if (trimmed === input.task.assignee?.trim()) {
    return { ok: false, reason: 'same_assignee', message: 'Already assigned to that person.' };
  }

  const state = taskState(input.task, input.now);
  if (state === 'done' || state === 'done-late') {
    return {
      ok: false,
      reason: 'completed',
      message: 'Finished work cannot be reassigned. Use Mark not done first if it was a mistake.',
    };
  }
  if (state === 'skipped') {
    return { ok: false, reason: 'skipped', message: 'Skipped tasks cannot be reassigned.' };
  }
  if (state === 'expired') {
    return {
      ok: false,
      reason: 'expired',
      message: 'Expired tasks stay in Expired. Assign a fresh occurrence for tomorrow instead.',
    };
  }
  if (!canFinishTask(input.task, input.now)) {
    return { ok: false, reason: 'not_open', message: 'Only open tasks can be reassigned.' };
  }

  const now = input.now ?? new Date();
  const timezone = resolveHouseholdTimezone(input.timezone);
  const todayKey = formatDateInTimezone(now, timezone);
  const tomorrowKey = addCalendarDays(todayKey, 1);
  const graceDueAt = wallTimeToUtc(tomorrowKey, input.dailyDeadlineHm, timezone).toISOString();
  const pastDeadline = isPastDailyDeadline(now, input.dailyDeadlineHm, timezone);
  const previousAssignee = input.task.assignee;

  const baseClear: Partial<HouseholdTask> = {
    assignee: trimmed,
    assignees: [trimmed],
    shares: undefined,
    splitXpEach: undefined,
    splitBonusXp: undefined,
    splitPenaltyXp: undefined,
    completedAt: undefined,
    awardedXp: undefined,
    completedLate: false,
    latenessMinutes: undefined,
    expiredAt: undefined,
    reassignedAt: now.toISOString(),
    reassignedFrom: previousAssignee,
    reassignFullXpUntil: graceDueAt,
  };

  if (!pastDeadline) {
    return {
      ok: true,
      mode: 'same_day_grace',
      previousAssignee,
      nextAssignee: trimmed,
      dropsFromPreviousDenominator: true,
      doesNotMissNewAssignee: true,
      seriesScope: 'this',
      patch: {
        ...baseClear,
        status: input.task.status === 'Overdue' ? 'Pending' : input.task.status,
        reassignCarriedOvernight: false,
      },
      summary: `Give to ${trimmed} today. They get full XP tonight or tomorrow (before the deadline). If it isn’t finished tonight it carries to tomorrow — ${previousAssignee} will not take a miss.`,
    };
  }

  const occurrence = resolveAssignOccurrence({
    now,
    dailyDeadlineHm: input.dailyDeadlineHm,
    timezone,
  });

  return {
    ok: true,
    mode: 'next_day_grace',
    previousAssignee,
    nextAssignee: trimmed,
    dropsFromPreviousDenominator: true,
    doesNotMissNewAssignee: true,
    seriesScope: 'this',
    patch: {
      ...baseClear,
      status: 'Pending',
      due: occurrence.dueLabel,
      dueAt: graceDueAt,
      occurrenceDate: occurrence.occurrenceDate,
      // Already on the grace day — next midnight expiry uses normal rules.
      reassignCarriedOvernight: true,
    },
    summary: `Past the deadline — moving this to tomorrow for ${trimmed} with full XP until tomorrow’s deadline. ${previousAssignee} will not take a miss.`,
  };
}

export function applyReassignmentPlan(task: HouseholdTask, plan: ReassignPlanOk): HouseholdTask {
  return {
    ...task,
    ...plan.patch,
    assignee: plan.nextAssignee,
    assignees: [plan.nextAssignee],
  };
}

/**
 * Effective due instant for Late Credit after a reassignment grace.
 * Full XP until reassignFullXpUntil; Late Credit only after that (day 2 late).
 */
export function effectiveDueAtForAward(task: Pick<HouseholdTask, 'dueAt' | 'reassignFullXpUntil'>): string | undefined {
  return task.reassignFullXpUntil ?? task.dueAt;
}

/**
 * At day close: reassigned work that hasn’t used its overnight carry yet
 * rolls to the next day instead of Expired (smart handoff).
 */
export function carryReassignedOvernight(
  task: HouseholdTask,
  previousDateKey: string,
  options: {
    dailyDeadlineHm: string;
    timezone?: string | null;
    now?: Date;
  }
): HouseholdTask | null {
  if (!task.reassignedAt || task.reassignCarriedOvernight) return null;
  if (task.status === 'Completed' || task.status === 'Cancelled') return null;
  if (task.occurrenceDate && task.occurrenceDate !== previousDateKey) return null;

  const timezone = resolveHouseholdTimezone(options.timezone);
  const nextKey = addCalendarDays(previousDateKey, 1);
  const graceDueAt =
    task.reassignFullXpUntil ??
    wallTimeToUtc(nextKey, options.dailyDeadlineHm, timezone).toISOString();
  const now = options.now ?? new Date();
  const todayKey = formatDateInTimezone(now, timezone);
  const dueLabel = nextKey === todayKey ? 'Today' : nextKey > todayKey ? 'Tomorrow' : nextKey;

  return {
    ...task,
    status: 'Pending',
    occurrenceDate: nextKey,
    due: dueLabel,
    dueAt: graceDueAt,
    reassignFullXpUntil: graceDueAt,
    reassignCarriedOvernight: true,
    completedLate: false,
    expiredAt: undefined,
  };
}
