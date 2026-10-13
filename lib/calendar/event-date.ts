import { addDays, format, parseISO, startOfDay } from 'date-fns';

/** YYYY-MM-DD for a calendar day selection. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayKey(reference = new Date()): string {
  return toDateKey(reference);
}

export function tomorrowKey(reference = new Date()): string {
  return toDateKey(addDays(reference, 1));
}

/** Parse "5:30 PM" style labels into 24h hours/minutes (fallback noon). */
export function parseTimeLabel(timeLabel: string): { hours: number; minutes: number } {
  const trimmed = timeLabel.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return { hours: 12, minutes: 0 };
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return { hours, minutes };
}

/** Build ISO startsAt from a fixed calendar day + time label. */
export function buildStartsAtIso(dateKey: string, timeLabel: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const { hours, minutes } = parseTimeLabel(timeLabel);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, hours, minutes, 0, 0);
  return local.toISOString();
}

/** Human label stored alongside startsAt (not "Today" — the actual date). */
export function formatStoredDateLabel(dateKey: string): string {
  const parsed = parseISO(`${dateKey}T12:00:00`);
  return format(parsed, 'EEE, MMM d');
}

export function isHomeworkTask(task: { category: string; title: string }): boolean {
  const blob = `${task.category} ${task.title}`.toLowerCase();
  return blob.includes('homework') || task.category === 'Homework' || task.category === 'homework_education';
}

/** Resolve a task due label to YYYY-MM-DD when possible. */
export function taskDueDateKey(
  task: {
    due: string;
    dueDate?: string | null;
    dueAt?: string | null;
    occurrenceDate?: string | null;
  },
  reference = new Date()
): string | null {
  if (task.occurrenceDate?.trim()) {
    return task.occurrenceDate.trim();
  }
  if (task.dueAt?.trim()) {
    return task.dueAt.trim().slice(0, 10);
  }
  if (task.dueDate?.trim()) {
    return task.dueDate.trim().slice(0, 10);
  }
  const label = task.due.trim().toLowerCase();
  if (label.includes('today')) return todayKey(reference);
  if (label.includes('tomorrow')) return tomorrowKey(reference);
  const parsed = Date.parse(task.due);
  if (!Number.isNaN(parsed)) return toDateKey(new Date(parsed));
  return null;
}

export function startOfDayFromKey(dateKey: string): Date {
  return startOfDay(parseISO(`${dateKey}T12:00:00`));
}
