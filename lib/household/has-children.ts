import type { HouseholdMember } from '@/types/orbit';

export function householdHasChildren(members: HouseholdMember[]): boolean {
  return members.some((member) => member.status === 'active' && member.role === 'child');
}

export function childMembers(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter((member) => member.status === 'active' && member.role === 'child');
}

export function isChildMember(member: HouseholdMember | null | undefined): boolean {
  return member?.role === 'child';
}
