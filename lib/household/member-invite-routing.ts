import { memberConnectionPhase } from '@/lib/household/member-connection';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

/** Sidekick / pre-created profile invites use CMX-NAME codes (scan, AirDrop, no email). */
export function memberUsesProfileInvite(member: HouseholdMember): boolean {
  return member.role === 'child' || Boolean(member.profileInviteCode?.trim());
}

/** Adults with their own account use per-member token invites. */
export function memberUsesTokenInvite(member: HouseholdMember): boolean {
  if (memberUsesProfileInvite(member)) return false;
  if (member.role === 'owner' || isSharedDeviceRole(member.role)) return false;
  return true;
}

export function memberCanReceiveInvite(member: HouseholdMember): boolean {
  if (member.role === 'owner' || isSharedDeviceRole(member.role)) return false;
  // Sidekick profile codes stay shareable after connect so kids can re-scan if needed.
  if (memberUsesProfileInvite(member)) return true;
  return memberConnectionPhase(member) !== 'connected';
}
