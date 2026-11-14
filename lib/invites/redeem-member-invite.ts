/**
 * Revision G §3 / §6 — redeem a per-member invite token in one logical transaction.
 * Role is read from the stored token only. Client-supplied role is ignored.
 */

export type InviteTokenRole = 'admin' | 'sidekick';
export type InviteTokenStatus = 'active' | 'redeemed' | 'revoked' | 'expired';

export type StoredInviteToken = {
  token: string;
  householdId: string;
  householdName: string;
  memberId: string;
  memberName: string;
  role: InviteTokenRole;
  status: InviteTokenStatus;
  expiresAt: string;
  adminName?: string;
};

export type RedeemContext = {
  token: StoredInviteToken | null;
  memberExists: boolean;
  adminSeatCount: number;
  authUserHouseholdId: string | null;
  authUserMemberId: string | null;
  /** Ignored. Present so tests prove the client cannot self-name Admin. */
  clientRole?: string;
  now?: Date;
};

export type RedeemOk = {
  ok: true;
  role: InviteTokenRole;
  memberStatus: 'active' | 'pending';
  tokenStatus: 'redeemed';
  alreadyMember: boolean;
};

export type RedeemFail = {
  ok: false;
  code:
    | 'expired'
    | 'used'
    | 'revoked'
    | 'not_found'
    | 'member_gone'
    | 'other_household'
    | 'admin_cap';
  message: string;
  consumeToken: false;
};

export type RedeemResult = RedeemOk | RedeemFail;

const ADMIN_CAP = 2;

function expiredCopy(adminName?: string): string {
  const who = adminName?.trim() || 'an admin';
  return `This invite has expired. Ask ${who} for a new one.`;
}

export function redeemMemberInvite(ctx: RedeemContext): RedeemResult {
  const now = ctx.now ?? new Date();
  const invite = ctx.token;
  if (!invite) {
    return {
      ok: false,
      code: 'not_found',
      message: 'This invite has expired. Ask an admin for a new one.',
      consumeToken: false,
    };
  }

  if (invite.status === 'revoked' || invite.status === 'expired') {
    return {
      ok: false,
      code: invite.status,
      message: expiredCopy(invite.adminName),
      consumeToken: false,
    };
  }

  if (invite.status === 'redeemed') {
    return {
      ok: false,
      code: 'used',
      message: 'This invite has already been used.',
      consumeToken: false,
    };
  }

  if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
    return {
      ok: false,
      code: 'expired',
      message: expiredCopy(invite.adminName),
      consumeToken: false,
    };
  }

  if (!ctx.memberExists) {
    return {
      ok: false,
      code: 'member_gone',
      message: 'This invite is no longer valid. Ask an admin for a new one.',
      consumeToken: false,
    };
  }

  if (ctx.authUserHouseholdId && ctx.authUserHouseholdId !== invite.householdId) {
    return {
      ok: false,
      code: 'other_household',
      message: 'This account already belongs to another household.',
      consumeToken: false,
    };
  }

  if (ctx.authUserMemberId && ctx.authUserMemberId === invite.memberId) {
    return {
      ok: true,
      role: invite.role,
      memberStatus: 'active',
      tokenStatus: 'redeemed',
      alreadyMember: true,
    };
  }

  // Role is server-side on the token. Ignore ctx.clientRole.
  const role = invite.role;

  if (role === 'admin' && ctx.adminSeatCount >= ADMIN_CAP) {
    return {
      ok: false,
      code: 'admin_cap',
      message: 'Only two admins per household. Ask the owner to demote someone first.',
      consumeToken: false,
    };
  }

  return {
    ok: true,
    role,
    memberStatus: 'active',
    tokenStatus: 'redeemed',
    alreadyMember: false,
  };
}
