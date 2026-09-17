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

/** Stable series key. Repeat is a field on the rule — never part of the id. */
export function fallbackSeriesDefinitionId(title: string, assignee: string): string {
  return `series:${title}:${assignee}`;
}

export function seriesDefinitionId(task: HouseholdTask): string {
  return task.definitionId || fallbackSeriesDefinitionId(task.title, task.assignee);
}

export function isExpiredStatus(status: HouseholdTask['status']): boolean {
  return status === 'Expired' || status === 'Missed';
}

function occurrenceDateKey(task: HouseholdTask): string {
  return task.occurrenceDate || (task.dueAt ? formatLocalDate(new Date(task.dueAt)) : '');
}

/**
 * The live household rule for a series.
 * Walk newest → oldest. Skip-today (cancelled, still repeating) is ignored.
 * Doesn’t repeat on the newest non-skip day stops the series — even if older
 * completions are still Daily.
 */
export function pickSeriesTemplate(members: HouseholdTask[]): HouseholdTask | null {
  if (!members.length) return null;
  const sorted = [...members].sort((a, b) =>
    occurrenceDateKey(b).localeCompare(occurrenceDateKey(a))
  );
  let skippedTemplate: HouseholdTask | null = null;
  for (const row of sorted) {
    const skippedDay = row.status === 'Cancelled' && row.repeat !== 'None';
    if (skippedDay) {
      skippedTemplate ??= row;
      continue;
    }
    if (row.repeat === 'None') return null;
    return row;
  }
  return skippedTemplate;
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
  day: Date = new Date(),
  dueTimeLocal = DEFAULT_DUE_TIME_LOCAL,
  options?: { skipAssignees?: Iterable<string> }
): HouseholdTask[] {
  const dateKey = formatLocalDate(day);
  const skip = new Set(options?.skipAssignees ?? []);

  // Prefer the latest open rule. A stopped series (latest open is Doesn’t repeat)
  // must not resurrect from an old Daily completion.
  const templates = new Map<string, HouseholdTask>();
  const bySeries = new Map<string, HouseholdTask[]>();
  for (const task of tasks) {
    const defId = seriesDefinitionId(task);
    const list = bySeries.get(defId) ?? [];
    list.push(task);
    bySeries.set(defId, list);
  }
  for (const [defId, members] of bySeries) {
    const template = pickSeriesTemplate(members);
    if (template) templates.set(defId, template);
  }

  const created: HouseholdTask[] = [];
  for (const [defId, template] of templates) {
    if (!shouldGenerateOnDate(template, day)) continue;
    const names = getTaskAssignees(template);
    if (names.length > 0 && names.every((name) => skip.has(name))) continue;

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

    created.push({
      ...template,
      id: '', // repository assigns
      definitionId: defId,
      occurrenceDate: dateKey,
      status: 'Pending',
      due: dueLabelForDate(dateKey, day),
      dueAt: localDueAt(dateKey, dueTimeLocal),
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
 * At day rollover: pending/late from previous day → Expired (Rev F §5 / DEAD-04).
 * Uses House Rules expiryTime (23:59). Recess assignees are skipped (STRK-04).
 * Never touches completed (including unreviewed).
 */
export function rolloverMissedOccurrences(
  tasks: HouseholdTask[],
  previousDateKey: string,
  now = new Date(),
  options?: {
    expiryHm?: string;
    skipAssigneeNames?: string[];
  }
): HouseholdTask[] {
  const expiredAt = now.toISOString();
  const expiryHm = options?.expiryHm ?? '23:59';
  const skip = new Set(options?.skipAssigneeNames ?? []);
  const { hours, minutes } = parseLocalHm(expiryHm);
  const [y, m, d] = previousDateKey.split('-').map(Number);
  const boundary = new Date(y, (m ?? 1) - 1, d ?? 1, hours, minutes, 59, 999);
  if (now.getTime() <= boundary.getTime()) return tasks;

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
    const due = task.dueAt ? new Date(task.dueAt) : null;
    const belongsToPrevious =
      task.occurrenceDate === previousDateKey ||
      (due && formatLocalDate(due) === previousDateKey) ||
      /yesterday|overdue/i.test(task.due);

    if (!belongsToPrevious) return task;
    const names = getTaskAssignees(task);
    if (names.length > 0 && names.every((name) => skip.has(name))) {
      return task;
    }

    return { ...task, status: 'Expired' as const, expiredAt: task.expiredAt ?? expiredAt };
  });
}

/** Alias matching Rev F vocabulary. */
export const rolloverExpiredOccurrences = rolloverMissedOccurrences;
