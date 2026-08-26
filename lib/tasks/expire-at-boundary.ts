/**
 * House Rules v4 — expire open tasks at constants.expiryTime (DEAD-04).
 * Recess days skip expiry (STRK-04: tasks off, streaks frozen).
 */
import { parseLocalHm } from '@/lib/tasks/recurrence-defaults';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import { getTaskAssignees } from '@/lib/tasks/split-assign';
import type { HouseholdTask } from '@/types/orbit';

const OPEN: HouseholdTask['status'][] = ['Pending', 'In Progress', 'Overdue'];

export function occurrenceDateKey(task: HouseholdTask, now = new Date()): string | null {
  if (task.occurrenceDate) return task.occurrenceDate;
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (!Number.isNaN(due.getTime())) return formatLocalDate(due);
  }
  if (/yesterday/i.test(task.due)) {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return formatLocalDate(y);
  }
  if (/today/i.test(task.due)) return formatLocalDate(now);
  return null;
}

/** Inclusive end of the occurrence day at HH:MM:59.999 household-local. */
export function expiryInstantLocal(dateKey: string, expiryHm: string): Date {
  const { hours, minutes } = parseLocalHm(expiryHm);
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hours, minutes, 59, 999);
}

export function expireOpenTasksAtBoundary(
  tasks: HouseholdTask[],
  now: Date,
  input: {
    expiryHm: string;
    assigneeOnRecess?: (assigneeName: string, dateKey: string) => boolean;
  }
): HouseholdTask[] {
  const expiredAt = now.toISOString();
  return tasks.map((task) => {
    if (!OPEN.includes(task.status) || isExpiredStatus(task.status)) return task;
    const dateKey = occurrenceDateKey(task, now);
    if (!dateKey) return task;
    if (dateKey > formatLocalDate(now)) return task;
    if (now.getTime() <= expiryInstantLocal(dateKey, input.expiryHm).getTime()) return task;
    const names = getTaskAssignees(task);
    if (
      names.length > 0 &&
      names.every((name) => input.assigneeOnRecess?.(name, dateKey))
    ) {
      return task;
    }
    return { ...task, status: 'Expired' as const, expiredAt: task.expiredAt ?? expiredAt };
  });
}
