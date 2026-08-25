import { formatLocalDate } from '@/lib/streaks/local-date';

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
