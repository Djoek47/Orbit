/**
 * Revision F §12.2 — unassign / remove incomplete occurrences.
 */

import { isExpiredStatus } from '@/lib/tasks/recurring';
import type { HouseholdTask } from '@/types/orbit';

export type UnassignScope = 'today' | 'permanently';

export function canAdminUnassign(task: HouseholdTask): boolean {
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  if (isExpiredStatus(task.status)) return false;
  return (
    task.status === 'Pending' ||
    task.status === 'In Progress' ||
    task.status === 'Overdue'
  );
}

/** Notify copy — Rev F §12.2.e */
export function unassignNotifyCopy(adminName: string, taskTitle: string): string {
  return `${adminName} removed ${taskTitle} from today.`;
}
