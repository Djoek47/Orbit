/**
 * Eligibility + countdown helpers for household recovery UI (Stop 4).
 * Recovery is only for owner/admin of a named household with a pending purge —
 * never for brand-new accounts with no membership history.
 */
import {
  canManageHouseholdDeletion,
  householdDeletionMsRemaining,
  isHouseholdDeletionPending,
} from '@/lib/household/household-deletion';

export type RecoverableMembership = {
  householdId: string;
  householdName: string;
  role: string;
  deletionScheduledFor?: string | null;
};

export type RecoveryCountdownParts = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Compact live label e.g. "12d 04h 18m 02s" or "03h 12m 05s". */
  label: string;
};

/** Named household = real history, not an unnamed draft shell. */
export function isNamedHousehold(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== 'household' && lower !== 'your household' && lower !== 'new household';
}

export function isRecoverableDeletionMembership(
  entry: RecoverableMembership,
  now = new Date()
): boolean {
  if (!canManageHouseholdDeletion(entry.role)) return false;
  if (!isNamedHousehold(entry.householdName)) return false;
  if (!isHouseholdDeletionPending({ deletionScheduledFor: entry.deletionScheduledFor })) {
    return false;
  }
  const scheduled = entry.deletionScheduledFor!;
  return householdDeletionMsRemaining(scheduled, now) > 0;
}

/**
 * Brand-new / empty accounts: zero memberships → no recovery surface.
 * Recoverable shells only appear when there is at least one pending deletion
 * the user can manage.
 */
export function listRecoverableDeletions(
  memberships: RecoverableMembership[],
  now = new Date()
): RecoverableMembership[] {
  if (!memberships.length) return [];
  return memberships.filter((entry) => isRecoverableDeletionMembership(entry, now));
}

export function canOpenHouseholdRecovery(input: {
  role: string | null | undefined;
  householdName: string | null | undefined;
  deletionScheduledFor?: string | null;
  /** When true, caller already verified membership history exists. */
  hasMembershipHistory: boolean;
}): boolean {
  if (!input.hasMembershipHistory) return false;
  return isRecoverableDeletionMembership({
    householdId: 'active',
    householdName: input.householdName ?? '',
    role: input.role ?? '',
    deletionScheduledFor: input.deletionScheduledFor,
  });
}

export function deletionCountdownParts(
  scheduledFor: string,
  now = new Date()
): RecoveryCountdownParts {
  const totalMs = Math.max(0, householdDeletionMsRemaining(scheduledFor, now));
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label =
    days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
      : hours > 0
        ? `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
        : `${pad(minutes)}m ${pad(seconds)}s`;
  return { totalMs, days, hours, minutes, seconds, label };
}
