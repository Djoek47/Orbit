import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';

export type InviteKind = 'household' | 'profile';

export type InviteSession = {
  isSignedIn: boolean;
  isPendingMember: boolean;
  hasHousehold: boolean;
};

export type InviteDestination =
  | 'pending-approval'
  | 'join-household'
  | 'welcome-invited'
  | 'welcome-child'
  | 'join-profile'
  | 'home';

/**
 * Household invites are CMX-#### (digits).
 * Kid / shared-device profile invites are CMX-NAME (letters), e.g. CMX-EMMA.
 * Same URL scheme for both — the suffix decides the path.
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

/**
 * Where an invite should land. Never dump a household invite on Get Started
 * or a kid-code field, and never bounce a pending adult back to their old home.
 */
export function nextInviteDestination(
  kind: InviteKind,
  session: InviteSession
): InviteDestination {
  if (kind === 'profile') {
    return 'join-profile';
  }
  if (session.isPendingMember) {
    return 'pending-approval';
  }
  if (session.isSignedIn) {
    return 'join-household';
  }
  return 'welcome-invited';
}

export function inviteHref(destination: InviteDestination, code: string): string {
  const encoded = encodeURIComponent(code);
  switch (destination) {
    case 'pending-approval':
      return '/pending-approval';
    case 'join-household':
      return `/join-household?code=${encoded}`;
    case 'welcome-invited':
      return `/welcome?invite=${encoded}`;
    case 'welcome-child':
      return `/welcome?invite=${encoded}&kind=child`;
    case 'join-profile':
      return `/join-profile?code=${encoded}`;
    case 'home':
      return '/';
  }
}

export function householdInviteWrongForKidMessage(code: string): string {
  return `${code} is a household invite, not a kid code. Sign in to join, then a parent can send your kid invite.`;
}

export function stillWaitingCopy(householdName?: string): string {
  const who = householdName?.trim() ? householdName.trim() : 'this household';
  return `Still waiting. An owner or admin of ${who} hasn’t approved you yet.`;
}
