/**
 * Household soft-delete policy (grace B).
 * Purge instant = deletion_scheduled_for. Reminders only in the final 7 days.
 */
export const HOUSEHOLD_DELETION_GRACE_DAYS = 30;

/** Reminders begin when remaining time ≤ this window. */
export const DELETION_REMINDER_WINDOW_DAYS = 7;

/** Accelerated purge confirm window after "delete now". */
export const IMMEDIATE_DELETION_CONFIRM_HOURS = 24;

export type DeletionReminderStage = '7d' | '3d' | '24h' | '1h11m';

export const DELETION_REMINDER_STAGE_ORDER: readonly DeletionReminderStage[] = [
  '7d',
  '3d',
  '24h',
  '1h11m',
] as const;

/** Max remaining ms at which each stage becomes eligible (inclusive). */
export const DELETION_REMINDER_THRESHOLDS_MS: Record<DeletionReminderStage, number> = {
  '7d': DELETION_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '1h11m': (60 + 11) * 60 * 1000,
};

/** Staging / local shortened ladder (minutes) for cron dry-runs. */
export const DELETION_REMINDER_STAGING_THRESHOLDS_MS: Record<DeletionReminderStage, number> = {
  '7d': 7 * 60 * 1000,
  '3d': 3 * 60 * 1000,
  '24h': 60 * 1000,
  '1h11m': 11 * 1000,
};

export function scheduleHouseholdDeletionDate(from = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + HOUSEHOLD_DELETION_GRACE_DAYS);
  return next.toISOString();
}

export function scheduleImmediateDeletionConfirmDate(from = new Date()): string {
  const next = new Date(from);
  next.setHours(next.getHours() + IMMEDIATE_DELETION_CONFIRM_HOURS);
  return next.toISOString();
}

export function isHouseholdDeletionPending(snapshot: {
  deletionScheduledFor?: string | null;
}): boolean {
  if (!snapshot.deletionScheduledFor?.trim()) return false;
  return new Date(snapshot.deletionScheduledFor).getTime() > Date.now();
}

export function householdDeletionMsRemaining(
  scheduledFor: string,
  now = new Date()
): number {
  return new Date(scheduledFor).getTime() - now.getTime();
}

export function householdDeletionDaysRemaining(
  scheduledFor: string,
  now = new Date()
): number {
  const ms = householdDeletionMsRemaining(scheduledFor, now);
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

/**
 * Next reminder stage to send, or null if none due.
 * Only fires inside the final 7-day window; walks the ladder in order so
 * late cron ticks still send unsent earlier stages first.
 */
export function nextDeletionReminderStage(
  scheduledFor: string,
  lastSent: DeletionReminderStage | null | undefined,
  now = new Date(),
  thresholds: Record<DeletionReminderStage, number> = DELETION_REMINDER_THRESHOLDS_MS
): DeletionReminderStage | null {
  const ms = householdDeletionMsRemaining(scheduledFor, now);
  if (ms <= 0) return null;
  if (ms > thresholds['7d']) return null;

  const lastIdx = lastSent ? DELETION_REMINDER_STAGE_ORDER.indexOf(lastSent) : -1;
  for (let i = 0; i < DELETION_REMINDER_STAGE_ORDER.length; i++) {
    if (i <= lastIdx) continue;
    const stage = DELETION_REMINDER_STAGE_ORDER[i]!;
    if (ms <= thresholds[stage]) return stage;
  }
  return null;
}

export function isDeletionReminderStage(
  value: string | null | undefined
): value is DeletionReminderStage {
  return (
    value === '7d' || value === '3d' || value === '24h' || value === '1h11m'
  );
}

/** Copy for Settings / delete screens — 30-day grace + final-week emails. */
export const HOUSEHOLD_DELETION_POLICY_COPY = {
  graceSummary: `${HOUSEHOLD_DELETION_GRACE_DAYS} days`,
  reminderLadder:
    'In the last week we email reminders at 7 days, 3 days, 24 hours, and about 1 hour before permanent deletion.',
  overview:
    `Your data is kept for ${HOUSEHOLD_DELETION_GRACE_DAYS} days in case this was a mistake. You can cancel anytime before permanent deletion. In the final week we send reminder emails (7 days, 3 days, 24 hours, and about 1 hour left).`,
  scheduled:
    `Your data is kept for ${HOUSEHOLD_DELETION_GRACE_DAYS} days — cancel anytime before then. Reminder emails start in the final week.`,
} as const;

export function canManageHouseholdDeletion(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}
