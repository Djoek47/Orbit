/**
 * Time-based occurrence generation (§5.2 / Rev F §1).
 * Completion never spawns — only midnight / foreground catch-up does.
 */

import type { HouseholdTask } from '@/types/orbit';
import { buildShares, getTaskAssignees, isSplitTask } from '@/lib/tasks/split-assign';
import { DEFAULT_DUE_TIME_LOCAL, parseLocalHm } from '@/lib/tasks/recurrence-defaults';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { dueLabelForDate } from '@/lib/tasks/due-label';

/** @deprecated Prefer ensureOccurrencesForDay — kept for cancel-this cleanup only. */
export function spawnNextOccurrence(task: HouseholdTask): HouseholdTask | null {
  // v2 §5.2 / Rev F §1.2.c: completion/cancel must not spawn. Return null always.
  void task;
  return null;
}

export function occurrenceKey(definitionId: string, occurrenceDate: string) {
  return `${definitionId}::${occurrenceDate}`;
}

function localDueAt(dateKey: string, dueTimeLocal = DEFAULT_DUE_TIME_LOCAL): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const { hours, minutes } = parseLocalHm(dueTimeLocal);
  return new Date(y, m - 1, d, hours, minutes, 0, 0).toISOString();
}

function shouldGenerateOnDate(task: HouseholdTask, date: Date): boolean {
  const day = date.getDay(); // 0 Sun
  switch (task.repeat) {
    case 'Daily':
      return true;
    case 'Weekdays':
      return day >= 1 && day <= 5;
    case 'Weekly':
      return day === 0; // Sunday default
    case 'None':
    default:
      return false;
  }
}

/** Template rows = completed/cancelled with a repeat rule, keyed by series. */
export function seriesDefinitionId(task: HouseholdTask): string {
  return task.definitionId || `series:${task.title}:${task.assignee}:${task.repeat}`;
}

export function isExpiredStatus(status: HouseholdTask['status']): boolean {
  return status === 'Expired' || status === 'Missed';
}

/** First chosen due / earliest occurrence — catch-up must not invent days before this. */
export function seriesStartDateKey(tasks: HouseholdTask[], defId: string): string | null {
  const keys = tasks
    .filter((t) => seriesDefinitionId(t) === defId)
    .map((t) => {
      if (t.occurrenceDate) return t.occurrenceDate;
      if (t.dueAt) return formatLocalDate(new Date(t.dueAt));
      return null;
    })
    .filter((key): key is string => Boolean(key))
    .sort();
  return keys[0] ?? null;
}

/**
 * Materialise today's pending occurrences for active repeating series.
 * Idempotent: skips if (definitionId, occurrenceDate) already exists.
 */
export function ensureOccurrencesForDay(
  tasks: HouseholdTask[],
  day: Date = new Date()
): HouseholdTask[] {
  const dateKey = formatLocalDate(day);

  // Prefer open templates; also learn series from any repeating row.
  const templates = new Map<string, HouseholdTask>();
  for (const task of tasks) {
    if (task.repeat === 'None') continue;
    const defId = seriesDefinitionId(task);
    if (!templates.has(defId)) templates.set(defId, task);
  }

  const created: HouseholdTask[] = [];
  for (const [defId, template] of templates) {
    if (!shouldGenerateOnDate(template, day)) continue;

    const startKey = seriesStartDateKey(tasks, defId);
    if (startKey && dateKey < startKey) continue;

    const exists = tasks.some((t) => {
      if (seriesDefinitionId(t) !== defId) return false;
      if (t.occurrenceDate === dateKey) return true;
      // Legacy rows without occurrenceDate: treat open/completed due-that-day as that occurrence.
      if (
        !t.occurrenceDate &&
        t.status !== 'Cancelled' &&
        (!t.dueAt || formatLocalDate(new Date(t.dueAt)) === dateKey) &&
        (t.status === 'Pending' ||
          t.status === 'In Progress' ||
          t.status === 'Overdue' ||
          t.status === 'Completed' ||
          /today|yesterday|overdue/i.test(t.due))
      ) {
        // Only match "today-ish" labels when asking for today.
        if (dateKey === formatLocalDate(new Date()) && /today/i.test(t.due)) return true;
        if (t.dueAt && formatLocalDate(new Date(t.dueAt)) === dateKey) return true;
        if (t.completedAt && formatLocalDate(new Date(t.completedAt)) === dateKey) return true;
      }
      return false;
    });
    if (exists) continue;

    // Skip seasonal / as-needed (encoded as None or missing dueAt with special due labels)
    if (/seasonal|as needed/i.test(template.due)) continue;

    const names = getTaskAssignees(template);
    created.push({
      ...template,
      id: '', // repository assigns
      definitionId: defId,
      occurrenceDate: dateKey,
      status: 'Pending',
      due: dueLabelForDate(dateKey, day),
      dueAt: localDueAt(dateKey),
      completedAt: undefined,
      awardedXp: undefined,
      completedLate: false,
      latenessMinutes: undefined,
      expiredAt: undefined,
      verification: template.proofRequired ? 'not_required' : 'not_required',
      proofUri: undefined,
      proofStatus: template.proofRequired ? 'none' : undefined,
      proofPhotoUrls: [],
      proofRounds: [],
      assignees: isSplitTask(template) ? names : template.assignees,
      shares: isSplitTask(template) ? buildShares(names, template.proofRequired) : undefined,
    });
  }
  return created;
}

/**
 * At day rollover: pending/late from previous day → Expired (Rev F §5).
 * Never touches completed (including unreviewed).
 */
export function rolloverMissedOccurrences(
  tasks: HouseholdTask[],
  previousDateKey: string,
  now = new Date()
): HouseholdTask[] {
  const expiredAt = now.toISOString();
  return tasks.map((task) => {
    if (
      task.status === 'Completed' ||
      task.status === 'Cancelled' ||
      isExpiredStatus(task.status)
    ) {
      return task;
    }
    if (task.occurrenceDate && task.occurrenceDate !== previousDateKey) {
      return task;
    }
    // Date-keyed or dueAt before today
    const due = task.dueAt ? new Date(task.dueAt) : null;
    const belongsToPrevious =
      task.occurrenceDate === previousDateKey ||
      (due && formatLocalDate(due) === previousDateKey) ||
      /yesterday|overdue/i.test(task.due);

    if (!belongsToPrevious) return task;
    if (due && due.getTime() > now.getTime()) return task;

    return { ...task, status: 'Expired' as const, expiredAt: task.expiredAt ?? expiredAt };
  });
}

/** Alias matching Rev F vocabulary. */
export const rolloverExpiredOccurrences = rolloverMissedOccurrences;
