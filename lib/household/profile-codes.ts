import { createInviteCode, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import type { HouseholdMember } from '@/types/orbit';
import { isSharedDeviceRole } from '@/lib/household/shared-device';

/** Members that can be hosted on a shared iPad via profile code. */
export function profileHostCandidates(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) =>
      member.status === 'active' &&
      !isSharedDeviceRole(member.role) &&
      member.role !== 'guest' &&
      member.role !== 'owner'
  );
}

export function ensureProfileInviteCode(member: HouseholdMember): string {
  if (member.profileInviteCode?.trim()) {
    return normalizeInviteCode(member.profileInviteCode);
  }
  const fromName = member.name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
  if (fromName.length >= 3) {
    return normalizeInviteCode(`CMX-${fromName}`);
  }
  return createInviteCode();
}

export function resolveMemberByProfileCode(
  raw: string,
  members: HouseholdMember[]
): HouseholdMember | null {
  const code = parseInvitePayload(raw) ?? (raw.trim() ? normalizeInviteCode(raw) : null);
  if (!code) return null;
  const match = members.find(
    (member) =>
      member.status === 'active' &&
      !isSharedDeviceRole(member.role) &&
      member.role !== 'guest' &&
      normalizeInviteCode(member.profileInviteCode ?? ensureProfileInviteCode(member)) === code
  );
  return match ?? null;
}

/** Build deep/web links for a per-profile invite (same scheme as household invites). */
export function buildProfileInviteLinks(code: string) {
  const normalized = normalizeInviteCode(code);
  return {
    code: normalized,
    deepLink: `choremaxx://join/${normalized}`,
    webLink: `https://choremaxx.app/join/${normalized}`,
  };
}
