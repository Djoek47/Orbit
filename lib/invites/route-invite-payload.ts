/**
 * Classify pasted / deep-link invite payloads before join screens run.
 * Shared-device multi-code URLs must win over CMX profile / household parsing.
 */
import { parseSharedDeviceInvitePayload } from '@/lib/household/shared-device-invite';
import {
  classifyInviteCode,
  inviteHref,
  nextInviteDestination,
  type InviteDestination,
  type InviteKind,
} from '@/lib/invites/invite-intent';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';

export type RoutedInvite =
  | { kind: 'shared-device'; payload: string; href: string }
  | { kind: 'profile' | 'household'; code: string; href: string; inviteKind: InviteKind }
  | { kind: 'unsupported'; code: string; href: string };

export function routeInvitePayload(
  raw: string,
  session: { isSignedIn: boolean; isPendingMember: boolean; hasHousehold: boolean }
): RoutedInvite | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const shared = parseSharedDeviceInvitePayload(trimmed);
  if (shared) {
    return {
      kind: 'shared-device',
      payload: trimmed,
      href: `/join-shared-device?payload=${encodeURIComponent(trimmed)}`,
    };
  }

  const code = parseInvitePayload(trimmed) ?? normalizeInviteCode(trimmed);
  if (!code) return null;

  const inviteKind: InviteKind = classifyInviteCode(code) ?? 'household';
  const dest: InviteDestination = nextInviteDestination(inviteKind, session);
  if (inviteKind === 'profile' || inviteKind === 'household') {
    return {
      kind: inviteKind,
      code,
      inviteKind,
      href: inviteHref(dest, code),
    };
  }
  return {
    kind: 'unsupported',
    code,
    href: inviteHref(dest, code),
  };
}

/** True when this profile member is already listed on a shared-device shell. */
export function memberIsOnSharedShell(
  memberId: string,
  members: Array<{ id: string; role?: string; sharedWithMemberIds?: string[] | null }>
): boolean {
  return members.some(
    (m) =>
      m.role === 'shared-device' &&
      Array.isArray(m.sharedWithMemberIds) &&
      m.sharedWithMemberIds.includes(memberId)
  );
}
