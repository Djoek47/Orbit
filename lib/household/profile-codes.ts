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

export function childInviteStem(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
}

/** First Sidekick code from a name (`CMX-LIAM`). */
export function childInviteCodeFromName(name: string): string {
  const fromName = childInviteStem(name);
  if (fromName.length >= 3) {
    return normalizeInviteCode(`CMX-${fromName}`);
  }
  return createInviteCode();
}

/**
 * Globally unique `profile_invite_code`. Collisions bump `CMX-LIAM` → `CMX-LIAM2`.
 * Mock and Supabase retry with the same sequence.
 */
export function allocateChildInviteCode(name: string, taken: Iterable<string> = []): string {
  const takenSet = new Set(
    [...taken].map((code) => normalizeInviteCode(code)).filter(Boolean)
  );
  const fromName = childInviteStem(name);
  let attempt = childInviteCodeFromName(name);
  let n = 2;
  while (takenSet.has(attempt)) {
    if (fromName.length >= 3) {
      attempt = normalizeInviteCode(`CMX-${fromName.slice(0, 4)}${n}`);
    } else {
      attempt = createInviteCode();
    }
    n += 1;
    if (n > 80) {
      attempt = createInviteCode();
      if (!takenSet.has(attempt)) break;
    }
  }
  return attempt;
}

export function ensureProfileInviteCode(member: HouseholdMember): string {
  if (member.profileInviteCode?.trim()) {
    return normalizeInviteCode(member.profileInviteCode);
  }
  return childInviteCodeFromName(member.name);
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
