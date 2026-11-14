/**
 * Household ownership transfer via QR (TTL 15 minutes).
 * Destination: empty account OR only recoverable scheduled-delete shells.
 */
import { INVITE_WEB_ORIGIN } from '@/lib/invites/invite-host';
import { isHouseholdDeletionPending } from '@/lib/household/household-deletion';
import { isNamedHousehold } from '@/lib/household/household-recovery';

export const HOUSEHOLD_TRANSFER_TTL_MS = 15 * 60 * 1000;

export type TransferMembership = {
  householdId: string;
  householdName: string;
  role: string;
  status: string;
  deletionScheduledFor?: string | null;
};

/** Healthy (non-recoverable) active/pending membership blocks transfer accept. */
export function isHealthyActiveMembership(entry: TransferMembership, now = new Date()): boolean {
  if (entry.status !== 'active' && entry.status !== 'pending') return false;
  if (isHouseholdDeletionPending({ deletionScheduledFor: entry.deletionScheduledFor })) {
    return false;
  }
  // Past or missing purge with deleted-style shell still counts as blocking if active
  // without a future deletion schedule.
  void now;
  return true;
}

/**
 * Empty account for transfer accept:
 * zero active/pending memberships, OR only recoverable scheduled-delete shells.
 */
export function isEmptyAccountForTransfer(
  memberships: TransferMembership[],
  now = new Date()
): boolean {
  const relevant = memberships.filter(
    (m) => m.status === 'active' || m.status === 'pending'
  );
  if (relevant.length === 0) return true;
  return relevant.every(
    (m) => !isHealthyActiveMembership(m, now)
  );
}

export function emptyAccountTransferMessage(): string {
  return 'Transfer only works on an empty account — sign in with a new account, or one that only has a household already scheduled for deletion.';
}

export function buildHouseholdTransferDeepLink(token: string): string {
  return `orbit://transfer-household?token=${encodeURIComponent(token)}`;
}

export function buildHouseholdTransferWebLink(token: string): string {
  return `${INVITE_WEB_ORIGIN}/transfer-household?token=${encodeURIComponent(token)}`;
}

/** Prefer choremaxx scheme for share sheets; both parse. */
export function buildHouseholdTransferShareLink(token: string): string {
  return `choremaxx://transfer-household?token=${encodeURIComponent(token)}`;
}

export function parseHouseholdTransferTokenFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const trimmed = url.trim();
    const scheme = trimmed.match(
      /(?:choremaxx|orbit):\/\/transfer-household(?:\?|#|&|\/)?.*?(?:token=)([^&?#]+)/i
    );
    if (scheme?.[1]) return decodeURIComponent(scheme[1]);
    const web = trimmed.match(/\/transfer-household\?[^#]*token=([^&?#]+)/i);
    if (web?.[1]) return decodeURIComponent(web[1]);
  } catch {
    return null;
  }
  return null;
}

export function transferTokenExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + HOUSEHOLD_TRANSFER_TTL_MS).toISOString();
}

export function transferSecondsRemaining(expiresAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
}

export function formatTransferCountdown(expiresAt: string, now = new Date()): string {
  const sec = transferSecondsRemaining(expiresAt, now);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Owner can generate a transfer QR for a named live household. */
export function canGenerateHouseholdTransfer(input: {
  role: string | null | undefined;
  householdName: string | null | undefined;
  deletionScheduledFor?: string | null;
}): boolean {
  if (input.role !== 'owner') return false;
  if (!isNamedHousehold(input.householdName)) return false;
  if (isHouseholdDeletionPending({ deletionScheduledFor: input.deletionScheduledFor })) {
    return false;
  }
  return true;
}

export function mintMockTransferToken(): { token: string; expiresAt: string } {
  const token = `xfer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return { token, expiresAt: transferTokenExpiresAt() };
}
