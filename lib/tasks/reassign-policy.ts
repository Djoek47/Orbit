/**
 * Smart admin reassignment — house-rules aligned.
 *
 * Before the household daily deadline → same day, fair window for the new assignee.
 * After the deadline (late window) → roll this occurrence to tomorrow so it does not
 * expire tonight and does not count as a miss for the previous assignee (Rev F §12.2.c).
 * Expired / completed / cancelled → blocked (DEAD-04 / Rev F §12.2).
 *
 * Precedence: Master Brief §3 + Rev F §12 + DEAD-03/04 + EARN-04.
 */
import { resolveAssignOccurrence } from '@/lib/tasks/assign-occurrence';
import { canFinishTask, taskState } from '@/lib/tasks/task-state';
import type { HouseholdTask } from '@/types/orbit';

export type ReassignMode = 'same_day' | 'next_day';

export type ReassignPlanOk = {
  ok: true;
  mode: ReassignMode;
  previousAssignee: string;
  nextAssignee: string;
  /** Streak: previous assignee loses this row from today's denominator. */
  dropsFromPreviousDenominator: true;
  /** Streak: new assignee is not charged a miss for the handoff itself. */
  doesNotMissNewAssignee: true;
  patch: Partial<HouseholdTask>;
  /** Short admin-facing explanation. */
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

  const occurrence = resolveAssignOccurrence({
    now: input.now,
    dailyDeadlineHm: input.dailyDeadlineHm,
    timezone: input.timezone,
  });

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
  };

  if (!occurrence.rolledToTomorrow) {
    return {
      ok: true,
      mode: 'same_day',
      previousAssignee,
      nextAssignee: trimmed,
      dropsFromPreviousDenominator: true,
      doesNotMissNewAssignee: true,
      patch: {
        ...baseClear,
        status: input.task.status === 'Overdue' ? 'Pending' : input.task.status,
      },
      summary: `Give to ${trimmed} for today. ${previousAssignee} is no longer on the hook — this will not count as their miss.`,
    };
  }

  // After the daily deadline: roll to tomorrow so the day can still close cleanly
  // and the new person gets a full window (not a last-minute Late Credit trap).
  return {
    ok: true,
    mode: 'next_day',
    previousAssignee,
    nextAssignee: trimmed,
    dropsFromPreviousDenominator: true,
    doesNotMissNewAssignee: true,
    patch: {
      ...baseClear,
      status: 'Pending',
      due: occurrence.dueLabel,
      dueAt: occurrence.dueAt,
      occurrenceDate: occurrence.occurrenceDate,
    },
    summary: `Past the household deadline — moving “${input.task.title}” to tomorrow for ${trimmed}. ${previousAssignee} will not take a miss for this handoff.`,
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
