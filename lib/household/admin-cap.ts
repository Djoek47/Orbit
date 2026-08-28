import {
  countAdminSeats,
  getAdminMembers,
  isAdminRole,
  MAX_FAMILY_ADMINS,
} from '@/lib/household/admins';
import { withHouseholdLock } from '@/lib/household/household-lock';
import type { HouseholdMember } from '@/types/orbit';

export { MAX_FAMILY_ADMINS };

export class AdminCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminCapError';
  }
}

export class NotOwnerError extends Error {
  constructor(message = 'Only the owner can promote an admin.') {
    super(message);
    this.name = 'NotOwnerError';
  }
}

export function adminCapBlockedMessage(members: HouseholdMember[], excludeId?: string): string {
  const other =
    getAdminMembers(members).find((member) => member.role === 'admin' && member.id !== excludeId) ??
    getAdminMembers(members).find((member) => member.id !== excludeId);
  const name = other?.name?.trim() || 'the other admin';
  return `Only two admins per household. Demote ${name} first.`;
}

/** Token role is written server-side. Non-owners can only mint sidekick. */
export function roleWrittenOnInvite(
  actorIsOwner: boolean,
  requested: 'admin' | 'sidekick'
): 'admin' | 'sidekick' {
  if (!actorIsOwner) return 'sidekick';
  return requested === 'admin' ? 'admin' : 'sidekick';
}

export function storageRoleFromToken(tokenRole: 'admin' | 'sidekick'): 'admin' | 'child' {
  return tokenRole === 'admin' ? 'admin' : 'child';
}

export function memberStatusFromToken(tokenRole: 'admin' | 'sidekick'): 'pending' | 'active' {
  return tokenRole === 'sidekick' ? 'active' : 'pending';
}

type PromoteArgs = {
  householdId: string;
  actorIsOwner: boolean;
  targetId: string;
  /**
   * Must be called **inside** the household lock so concurrent promotions
   * re-count after the previous write (Revision G A2.5).
   */
  readMembers: () => HouseholdMember[];
  writeAdmin: (memberId: string) => Promise<void> | void;
};

export async function promoteMemberToAdmin(
  args: PromoteArgs
): Promise<{ ok: true } | { ok: false; message: string }> {
  return withHouseholdLock(args.householdId, async () => {
    if (!args.actorIsOwner) {
      return { ok: false, message: new NotOwnerError().message };
    }
    const members = args.readMembers();
    const target = members.find((member) => member.id === args.targetId);
    if (!target) {
      return { ok: false, message: 'Member not found.' };
    }
    if (isAdminRole(target.role)) {
      return { ok: true };
    }
    if (countAdminSeats(members) >= MAX_FAMILY_ADMINS) {
      return { ok: false, message: adminCapBlockedMessage(members, args.targetId) };
    }
    await args.writeAdmin(args.targetId);
    return { ok: true };
  });
}
