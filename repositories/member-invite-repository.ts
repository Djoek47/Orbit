/**
 * Mock + live member-invite tokens (Revision G §2.1).
 * Role is written here, never from the redeeming client.
 */
import { mockHousehold } from '@/data/mock-household';
import {
  AdminCapError,
  adminCapBlockedMessage,
  roleWrittenOnInvite,
} from '@/lib/household/admin-cap';
import { countAdminSeats } from '@/lib/household/admins';
import { withHouseholdLock } from '@/lib/household/household-lock';
import {
  createMemberInvite,
  generateInviteToken,
  revokePreviousInvites,
  type MemberInvite,
} from '@/lib/household/member-invites';
import { redeemMemberInvite } from '@/lib/invites/redeem-member-invite';
import { getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { HouseholdMember, HouseholdSnapshot } from '@/types/orbit';

let mockTokens: MemberInvite[] = [];

export function __resetMockMemberInvitesForTests() {
  mockTokens = [];
}

export const memberInviteRepository = {
  async generate(input: {
    householdId: string;
    memberId: string;
    createdBy: string;
    actorIsOwner: boolean;
    requestedRole: 'admin' | 'sidekick';
    members: HouseholdMember[];
  }): Promise<MemberInvite> {
    const role = roleWrittenOnInvite(input.actorIsOwner, input.requestedRole);

    if (isMockMode()) {
      return withHouseholdLock(input.householdId, async () => {
        if (role === 'admin' && countAdminSeats(input.members) >= 2) {
          throw new AdminCapError(adminCapBlockedMessage(input.members));
        }
        mockTokens = revokePreviousInvites(mockTokens, input.memberId);
        const invite = createMemberInvite({
          householdId: input.householdId,
          memberId: input.memberId,
          createdBy: input.createdBy,
          token: generateInviteToken(),
          role,
        });
        mockTokens = [...mockTokens, invite];
        return invite;
      });
    }

    const supabase = getConfiguredSupabase('memberInviteRepository.generate');
    const { data, error } = await supabase.rpc('generate_member_invite', {
      p_member_id: input.memberId,
      p_requested_role: input.requestedRole,
    });
    mapDbError('memberInviteRepository.generate', error);
    const payload = (data ?? {}) as { token?: string; role?: 'admin' | 'sidekick' };
    if (!payload.token) {
      throw new Error('memberInviteRepository.generate: no token returned');
    }
    return createMemberInvite({
      householdId: input.householdId,
      memberId: input.memberId,
      createdBy: input.createdBy,
      token: payload.token,
      role: payload.role === 'admin' ? 'admin' : 'sidekick',
    });
  },
};

export function redeemMockMemberInvite(args: {
  token: string;
  clientRole?: string;
  authUserHouseholdId: string | null;
  authUserMemberId: string | null;
  members: HouseholdMember[];
}):
  | { ok: true; invite: MemberInvite; memberStatus: 'active' | 'pending'; alreadyMember: boolean }
  | { ok: false; message: string } {
  const invite = mockTokens.find((item) => item.token === args.token) ?? null;
  const member = args.members.find((item) => item.id === invite?.memberId);
  const result = redeemMemberInvite({
    token: invite
      ? {
          token: invite.token,
          householdId: invite.householdId,
          householdName: mockHousehold.householdName,
          memberId: invite.memberId,
          memberName: member?.name ?? 'Member',
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          adminName: args.members.find((item) => item.role === 'owner')?.name,
        }
      : null,
    memberExists: Boolean(member),
    adminSeatCount: countAdminSeats(args.members),
    authUserHouseholdId: args.authUserHouseholdId,
    authUserMemberId: args.authUserMemberId,
    clientRole: args.clientRole,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  if (!invite) {
    return { ok: false, message: 'This invite has expired. Ask an admin for a new one.' };
  }
  mockTokens = mockTokens.map((item) =>
    item.token === invite.token ? { ...item, status: 'redeemed', usedAt: new Date().toISOString() } : item
  );
  return {
    ok: true,
    invite,
    memberStatus: result.memberStatus,
    alreadyMember: result.alreadyMember,
  };
}

export function applyRedeemedMember(
  snapshot: HouseholdSnapshot,
  memberId: string,
  status: 'active' | 'pending',
  storageRole: 'admin' | 'child',
  userId?: string | null
): HouseholdSnapshot {
  return {
    ...snapshot,
    members: snapshot.members.map((member) =>
      member.id === memberId
        ? { ...member, status, role: storageRole, userId: userId ?? member.userId ?? null }
        : member
    ),
  };
}
