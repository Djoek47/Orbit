/**
 * Normalize open tasks past the house-rules expiry boundary for any client.
 * Used after Sidekick poll merge, admin reload, and periodic ticks.
 */
import { isOnRecess } from '@/lib/recess/recess-engine';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { expireOpenTasksAtBoundary } from '@/lib/tasks/expire-at-boundary';
import type { HouseholdSnapshot, HouseholdTask } from '@/types/orbit';

export type HouseholdExpiryContext = Pick<HouseholdSnapshot, 'members' | 'recessPeriods'>;

export function applyHouseholdTaskExpiry(
  tasks: HouseholdTask[],
  household: HouseholdExpiryContext,
  now = new Date()
): HouseholdTask[] {
  const expiryHm = getHouseRulesDoc().constants.expiryTime;
  return expireOpenTasksAtBoundary(tasks, now, {
    expiryHm,
    assigneeOnRecess: (name, dateKey) =>
      household.members.some(
        (member) =>
          member.name === name && isOnRecess(household.recessPeriods ?? [], member.id, dateKey)
      ),
  });
}

/** Tasks whose status changed after applying expiry (for persistence). */
export function tasksWithExpiryStatusChange(
  before: HouseholdTask[],
  after: HouseholdTask[]
): HouseholdTask[] {
  return after.filter((task) => {
    const prev = before.find((row) => row.id === task.id);
    return prev != null && prev.status !== task.status;
  });
}
