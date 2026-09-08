import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';

export type InviteKind = 'household' | 'profile';

export type InviteSession = {
  isSignedIn: boolean;
  isPendingMember: boolean;
  hasHousehold: boolean;
};

export type InviteDestination = 'invite-unsupported' | 'join-household' | 'join-profile' | 'home';

/**
 * Household invites are CMX-#### (digits) — legacy; product uses per-person invites only.
 * Sidekick profile invites are CMX-NAME (letters), e.g. CMX-EMMA.
 */
export function classifyInviteCode(raw: string): InviteKind | null {
  const code = parseInvitePayload(raw) ?? (raw.trim() ? normalizeInviteCode(raw) : null);
  if (!code) return null;
  const suffix = code.replace(/^(CMX|ORBIT)-/, '');
  if (/^\d{3,8}$/.test(suffix)) return 'household';
  if (/^[A-Z][A-Z0-9]{1,11}$/.test(suffix)) return 'profile';
  if (/^\d+$/.test(suffix)) return 'household';
  return 'profile';
}

export function inviteCodeFromRaw(raw: string): string | null {
  return parseInvitePayload(raw) ?? (raw.trim() ? normalizeInviteCode(raw) : null);
}

/** Route scanned / deep-linked invites — profile → join; legacy household → unsupported. */
export function nextInviteDestination(
  kind: InviteKind,
  session: InviteSession
): InviteDestination {
  if (kind === 'profile') {
    return 'join-profile';
  }
  if (session.isSignedIn && session.hasHousehold) {
    return 'join-household';
  }
  return 'invite-unsupported';
}

export function inviteHref(destination: InviteDestination, code: string): string {
  const encoded = encodeURIComponent(code);
  switch (destination) {
    case 'invite-unsupported':
      return `/invite-unsupported?code=${encoded}`;
    case 'join-household':
      return `/join-household?code=${encoded}`;
    case 'join-profile':
      return `/join-profile?code=${encoded}`;
    case 'home':
      return '/';
  }
}

export const LEGACY_HOUSEHOLD_INVITE_MESSAGE =
  'This is an older household-wide invite. Ask your admin for a personal invite from Manage Members.';

export function householdInviteWrongForKidMessage(code: string): string {
  return `${code} is not a Sidekick invite. Ask your admin for your personal code (like CMX-EMMA).`;
}
