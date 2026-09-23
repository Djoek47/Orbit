/**
 * Member connection lifecycle — pre-created roster vs fully connected app user.
 *
 * Pre-created members (onboarding / Settings) stay in `awaiting` until they
 * redeem an invite and bind a user account. Join approval was removed — anyone
 * who accepts an invite is active immediately.
 */

import { isPendingStatus } from '@/lib/invites/join-approval';
import type { HouseholdMember, HouseholdRole } from '@/types/orbit';

export type MemberConnectionPhase = 'connected' | 'awaiting';

const CONNECTED_ROLES: HouseholdRole[] = ['owner'];

function isConnectedAdmin(member: HouseholdMember): boolean {
  return member.role === 'admin' && member.status === 'active';
}

/** True when this member should count toward tasks, XP, rankings, and load. */
export function isMemberFullyConnected(member: HouseholdMember | null | undefined): boolean {
  if (!member) return false;
  if (CONNECTED_ROLES.includes(member.role)) return member.status === 'active';
  if (isConnectedAdmin(member)) return true;
  if (member.status !== 'active' && member.status !== 'pending') return false;
  if (member.role === 'child' && member.status === 'active') return true;
  return Boolean(member.userId?.trim());
}

/** Hourglass vs green check — connection phase for roster UI. */
export function memberConnectionPhase(
  member: HouseholdMember | null | undefined
): MemberConnectionPhase {
  if (!member) return 'awaiting';
  if (CONNECTED_OWNER(member)) return 'connected';
  if (isConnectedAdmin(member)) return 'connected';
  if (member.status === 'invited') return 'awaiting';
  if (member.status === 'pending' || member.status === 'active') {
    if (member.role === 'child' && member.status === 'active') return 'connected';
    if (isMemberFullyConnected(member)) return 'connected';
  }
  if (isMemberFullyConnected(member)) return 'connected';
  return 'awaiting';
}

function CONNECTED_OWNER(member: HouseholdMember): boolean {
  return member.role === 'owner' && member.status === 'active';
}

/** Short label under a member name in roster / Settings. */
export function memberConnectionLabel(member: HouseholdMember): string {
  return memberConnectionPhase(member) === 'connected' ? 'Connected' : 'Not connected yet';
}

/** Members eligible for task assignment / XP credit. */
export function connectedHouseholdMembers(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter((member) => isMemberFullyConnected(member));
}

/** Block reusing a previous display name when joining a new household. */
export function blocksPreviousDisplayName(previousName: string, nextName: string): boolean {
  const prev = previousName.trim().toLowerCase();
  const next = nextName.trim().toLowerCase();
  if (!prev || !next) return false;
  return prev === next;
}
