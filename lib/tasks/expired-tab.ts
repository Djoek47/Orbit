/**
 * Expired tab helpers — Rev F §5.
 */

import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import type { HouseholdTask } from '@/types/orbit';

function expiredPurgeMs(): number {
  const days = getHouseRulesDoc().constants.expiredPurgeDays;
  return days * 24 * 60 * 60 * 1000;
}

export function isExpiredTask(task: HouseholdTask): boolean {
  return isExpiredStatus(task.status);
}

export function isActiveTask(task: HouseholdTask): boolean {
  return (
    !isExpiredTask(task) &&
    task.status !== 'Completed' &&
    task.status !== 'Cancelled'
  );
}

export function isCompletedTask(task: HouseholdTask): boolean {
  return task.status === 'Completed';
}

function expiredStamp(task: HouseholdTask): Date | null {
  if (task.expiredAt) {
    const d = new Date(task.expiredAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (task.occurrenceDate) {
    const d = new Date(`${task.occurrenceDate}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (task.dueAt) {
    const d = new Date(task.dueAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** View filter: expiredAt within last 7 days (Expired tab only — history kept forever). */
export function isExpiredVisibleInTab(task: HouseholdTask, now = new Date()): boolean {
  if (!isExpiredTask(task)) return false;
  const stamp = expiredStamp(task);
  if (!stamp) return true;
  return now.getTime() - stamp.getTime() < expiredPurgeMs();
}

/**
 * Older expired rows kept for household health / Champion’s Record.
 * Not shown in the main Expired tab after 7 days (DEAD-08 view hide, not delete).
 */
export function isExpiredInHistory(task: HouseholdTask, now = new Date()): boolean {
  if (!isExpiredTask(task)) return false;
  return !isExpiredVisibleInTab(task, now);
}

export function countExpiredHistory(tasks: HouseholdTask[], now = new Date()): number {
  return tasks.filter((t) => isExpiredInHistory(t, now)).length;
}

export function expiredDayLabel(task: HouseholdTask, now = new Date()): string {
  const key =
    task.occurrenceDate ||
    (task.expiredAt ? formatLocalDate(new Date(task.expiredAt)) : null) ||
    (task.dueAt ? formatLocalDate(new Date(task.dueAt)) : null);
  if (!key) return 'Earlier';
  const today = formatLocalDate(now);
  const yday = new Date(now);
  yday.setDate(yday.getDate() - 1);
  if (key === today) return 'Today';
  if (key === formatLocalDate(yday)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

/** Group newest first by day key. */
export function groupExpiredByDay(
  tasks: HouseholdTask[],
  now = new Date()
): { label: string; dayKey: string; tasks: HouseholdTask[] }[] {
  const visible = tasks.filter((t) => isExpiredVisibleInTab(t, now));
  const map = new Map<string, HouseholdTask[]>();
  for (const task of visible) {
    const key =
      task.occurrenceDate ||
      (task.expiredAt ? formatLocalDate(new Date(task.expiredAt)) : 'unknown');
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dayKey, group]) => ({
      dayKey,
      label: expiredDayLabel(group[0]!, now),
      tasks: group,
    }));
}
