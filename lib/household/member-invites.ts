/**
 * Revision F §3 — per-member invites (7-day, single-use).
 */

export type MemberInvite = {
  id: string;
  householdId: string;
  memberId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
  createdBy: string;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** ≥128 bits URL-safe token. */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return toBase64Url(bytes);
}

export function inviteExpiresAt(createdAt: string | Date = new Date()): string {
  const start = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return new Date(start.getTime() + SEVEN_DAYS_MS).toISOString();
}

export function buildMemberInviteDeepLink(token: string): string {
  return `choremaxx://invite/member?token=${encodeURIComponent(token)}`;
}

export type RedeemResult =
  | { ok: true; invite: MemberInvite }
  | {
      ok: false;
      reason: 'expired' | 'used' | 'revoked' | 'not_found' | 'forbidden';
      message: string;
    };

export function validateMemberInvite(
  invite: MemberInvite | null | undefined,
  now = new Date()
): RedeemResult {
  if (!invite) {
    return { ok: false, reason: 'not_found', message: 'This invite link was not found.' };
  }
  if (invite.revokedAt) {
    return {
      ok: false,
      reason: 'revoked',
      message: 'This invite code is no longer valid. Ask an admin for a new one.',
    };
  }
  if (invite.usedAt) {
    return {
      ok: false,
      reason: 'used',
      message: 'This invite has already been used. Ask an admin to generate a new code.',
    };
  }
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: 'expired',
      message: 'This invite expired after 7 days. Ask an admin to generate a new code.',
    };
  }
  return { ok: true, invite };
}

export function createMemberInvite(input: {
  householdId: string;
  memberId: string;
  createdBy: string;
  token: string;
  now?: Date;
}): MemberInvite {
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  return {
    id: `inv-${input.memberId}-${now.getTime()}`,
    householdId: input.householdId,
    memberId: input.memberId,
    token: input.token,
    createdAt,
    expiresAt: inviteExpiresAt(createdAt),
    createdBy: input.createdBy,
  };
}

/** Issuing a new invite revokes the previous active one. */
export function revokePreviousInvites(
  invites: MemberInvite[],
  memberId: string,
  now = new Date()
): MemberInvite[] {
  const stamp = now.toISOString();
  return invites.map((inv) => {
    if (inv.memberId !== memberId) return inv;
    if (inv.usedAt || inv.revokedAt) return inv;
    return { ...inv, revokedAt: stamp };
  });
}

export function activeInviteForMember(
  invites: MemberInvite[],
  memberId: string,
  now = new Date()
): MemberInvite | null {
  return (
    invites.find((inv) => {
      if (inv.memberId !== memberId) return false;
      return validateMemberInvite(inv, now).ok;
    }) ?? null
  );
}

/** Friendly already-on-device copy (Rev F §3.4.c). */
export function alreadyOnDeviceMessage(memberName: string): string {
  return `${memberName} is already on this device.`;
}

export function markInviteUsed(invite: MemberInvite, now = new Date()): MemberInvite {
  return { ...invite, usedAt: now.toISOString() };
}
