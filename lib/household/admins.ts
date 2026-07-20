import type { HouseholdMember, HouseholdRole, HouseholdSnapshot, HouseholdType } from '@/types/orbit';

/** Owner and admin both count as family admin seats (co-parents). */
export const FAMILY_ADMIN_ROLES: HouseholdRole[] = ['owner', 'admin'];

/** Families can have two co-parent admins (typically owner + one admin). */
export const MAX_FAMILY_ADMINS = 2;

const FAMILY_HOUSEHOLD_TYPES: HouseholdType[] = ['family', 'single-parent', 'multi-generational'];

export function isAdminRole(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function usesFamilyAdminCap(type: HouseholdType | null | undefined): boolean {
  if (!type) return true;
  return FAMILY_HOUSEHOLD_TYPES.includes(type);
}

export function getAdminMembers(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter((member) => member.status === 'active' && isAdminRole(member.role));
}

export function countAdminSeats(members: HouseholdMember[]): number {
  return getAdminMembers(members).length;
}

/** Whether this member can be set to `admin` without exceeding the family seat cap. */
export function canPromoteToAdmin(
  household: Pick<HouseholdSnapshot, 'householdType' | 'members'>,
  memberId: string
): boolean {
  if (!usesFamilyAdminCap(household.householdType)) {
    return true;
  }
  const target = household.members.find((member) => member.id === memberId);
  if (target && isAdminRole(target.role)) {
    return true;
  }
  return countAdminSeats(household.members) < MAX_FAMILY_ADMINS;
}

/** The two people open tasks should split between — prefer active admins, else first two actives. */
export function resolveSplitPair(members: HouseholdMember[]): [HouseholdMember, HouseholdMember] | null {
  const admins = getAdminMembers(members);
  if (admins.length >= 2) {
    return [admins[0], admins[1]];
  }
  const active = members.filter((member) => member.status === 'active' && member.role !== 'guest');
  if (active.length >= 2) {
    if (admins.length === 1) {
      const partner = active.find((member) => member.id !== admins[0].id);
      if (partner) return [admins[0], partner];
    }
    return [active[0], active[1]];
  }
  return null;
}

export function familyAdminSeatsLabel(
  members: HouseholdMember[],
  type: HouseholdType | null | undefined
): string {
  const seats = countAdminSeats(members);
  if (!usesFamilyAdminCap(type)) {
    return `${seats} admin${seats === 1 ? '' : 's'}`;
  }
  return `${seats} of ${MAX_FAMILY_ADMINS} family admins`;
}
