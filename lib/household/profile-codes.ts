import { createInviteCode, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import type { HouseholdMember } from '@/types/orbit';
import { isSharedDeviceRole } from '@/lib/household/shared-device';

/**
 * Profile invite tokens — hard to guess, globally unique.
 *
 * New format: CMX- + 2-letter name stem + 4 random chars → e.g. CMX-EM7K4Q
 * (Household codes stay CMX-###### digits only.)
 *
 * Legacy name codes (CMX-EMMA, CMX-EMMA8) still parse and redeem; we just stop minting them.
 */

/** Unambiguous alphabet — no 0/O/1/I. */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

/** Two-letter display hint from a name (`EM` from Emma). Falls back to `XX`. */
export function childInviteHint(name: string): string {
  const stem = childInviteStem(name).replace(/[^A-Z]/g, '');
  if (stem.length >= 2) return stem.slice(0, 2);
  if (stem.length === 1) return `${stem}X`;
  return 'XX';
}

function randomTokenChars(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)]!;
  }
  return out;
}

/**
 * Legacy helper — first name-only code (`CMX-LIAM`). Kept for tests / reading old behaviour;
 * new mints use {@link allocateChildInviteCode}.
 */
export function childInviteCodeFromName(name: string): string {
  const fromName = childInviteStem(name);
  if (fromName.length >= 3) {
    return normalizeInviteCode(`CMX-${fromName}`);
  }
  return createInviteCode();
}

/** True when a code looks like the old guessable CMX-NAME / CMX-NAME8 style. */
export function isLegacyNameProfileCode(code: string): boolean {
  const normalized = normalizeInviteCode(code);
  const suffix = normalized.replace(/^(CMX|ORBIT)-/, '');
  return /^[A-Z]{3,6}\d{0,2}$/.test(suffix);
}

/**
 * Globally unique `profile_invite_code`.
 * Mints `CMX-{hint}{4 random}` — not sequential, not fully name-derived.
 */
export function allocateChildInviteCode(name: string, taken: Iterable<string> = []): string {
  const takenSet = new Set(
    [...taken].map((code) => normalizeInviteCode(code)).filter(Boolean)
  );
  const hint = childInviteHint(name);

  for (let n = 0; n < 64; n += 1) {
    const attempt = normalizeInviteCode(`CMX-${hint}${randomTokenChars(4)}`);
    if (!takenSet.has(attempt)) return attempt;
  }

  // Extremely unlikely — fall back to a longer random token.
  for (let n = 0; n < 16; n += 1) {
    const attempt = normalizeInviteCode(`CMX-${randomTokenChars(1)}${randomTokenChars(7)}`);
    if (!takenSet.has(attempt)) return attempt;
  }

  return normalizeInviteCode(`CMX-${hint}${randomTokenChars(6)}`);
}

export function ensureProfileInviteCode(member: HouseholdMember): string {
  if (member.profileInviteCode?.trim()) {
    return normalizeInviteCode(member.profileInviteCode);
  }
  // Don't mint a weak name-only code client-side — allocate a strong one.
  return allocateChildInviteCode(member.name);
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
