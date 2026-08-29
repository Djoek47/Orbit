/** Grace period before a scheduled household is permanently removed. */
export const HOUSEHOLD_DELETION_GRACE_DAYS = 15;

export function scheduleHouseholdDeletionDate(from = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + HOUSEHOLD_DELETION_GRACE_DAYS);
  return next.toISOString();
}

export function isHouseholdDeletionPending(snapshot: {
  deletionScheduledFor?: string | null;
}): boolean {
  if (!snapshot.deletionScheduledFor?.trim()) return false;
  return new Date(snapshot.deletionScheduledFor).getTime() > Date.now();
}

export function householdDeletionDaysRemaining(scheduledFor: string): number {
  const ms = new Date(scheduledFor).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function formatHouseholdDeletionDate(scheduledFor: string): string {
  return new Date(scheduledFor).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
