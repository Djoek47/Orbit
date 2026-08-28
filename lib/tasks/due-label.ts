import { formatLocalDate } from '@/lib/streaks/local-date';
import type { HouseholdTask } from '@/types/orbit';

/** Human due label that matches a local YYYY-MM-DD occurrence date. */
export function dueLabelForDate(dateKey: string, now = new Date()): string {
  const today = formatLocalDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dateKey === today) return 'Today';
  if (dateKey === formatLocalDate(tomorrow)) return 'Tomorrow';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function libraryDefinitionId(libraryTaskId: string, assignee: string): string {
  return `lib:${libraryTaskId}:${assignee}`;
}

export function occurrenceDateForDueLabel(due: string, now = new Date()): string {
  const d = new Date(now);
  if (/^tomorrow$/i.test(due)) d.setDate(now.getDate() + 1);
  else if (/this week/i.test(due)) {
    const toSat = (6 - now.getDay() + 7) % 7;
    d.setDate(now.getDate() + toSat);
  } else if (/next week/i.test(due)) {
    d.setDate(now.getDate() + 7);
  }
  return formatLocalDate(d);
}

/** Source-of-truth occurrence date for filters and display. */
export function resolveOccurrenceDate(
  task: Pick<HouseholdTask, 'occurrenceDate' | 'dueAt' | 'due'>,
  now = new Date()
): string | undefined {
  if (task.occurrenceDate?.trim()) return task.occurrenceDate.trim();
  if (task.dueAt?.trim()) {
    const due = new Date(task.dueAt);
    if (!Number.isNaN(due.getTime())) return formatLocalDate(due);
  }
  if (/tomorrow/i.test(task.due)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    return formatLocalDate(d);
  }
  if (/today/i.test(task.due)) return formatLocalDate(now);
  if (/this week/i.test(task.due)) {
    const d = new Date(now);
    const toSat = (6 - now.getDay() + 7) % 7;
    d.setDate(now.getDate() + toSat);
    return formatLocalDate(d);
  }
  return undefined;
}

/** Prefer occurrenceDate/dueAt; fall back to stored due label. */
export function displayDueLabel(
  task: Pick<HouseholdTask, 'occurrenceDate' | 'dueAt' | 'due'>,
  now = new Date()
): string {
  const occurrence = resolveOccurrenceDate(task, now);
  if (occurrence) return dueLabelForDate(occurrence, now);
  return task.due?.trim() || '';
}

/** Relabel open tasks whose occurrenceDate is today but due label is stale. */
export function refreshStaleDueLabels<T extends HouseholdTask>(
  tasks: T[],
  now = new Date()
): T[] {
  const today = formatLocalDate(now);
  let changed = false;
  const next = tasks.map((task) => {
    if (task.status === 'Completed' || task.status === 'Cancelled') return task;
    if (task.occurrenceDate !== today) return task;
    const label = displayDueLabel(task, now);
    if (label === task.due) return task;
    changed = true;
    return { ...task, due: label };
  });
  return changed ? next : tasks;
}
