/**
 * Member connection lifecycle — pre-created roster vs fully connected app user.
 *
 * Pre-created members (onboarding / Settings) stay in `awaiting` until they
 * redeem an invite, get approved, and bind a user account. Only then do they
 * count for tasks, XP, and rankings.
 */

import { isPendingStatus } from '@/lib/invites/join-approval';
import type { HouseholdMember, HouseholdRole } from '@/types/orbit';

export type MemberConnectionPhase = 'connected' | 'pending_approval' | 'awaiting';

const CONNECTED_ROLES: HouseholdRole[] = ['owner'];

/** True when this member should count toward tasks, XP, rankings, and load. */
export function isMemberFullyConnected(member: HouseholdMember | null | undefined): boolean {
  if (!member) return false;
  if (CONNECTED_ROLES.includes(member.role)) return member.status === 'active';
  if (isPendingStatus(member.status)) return false;
  if (member.status !== 'active') return false;
  return Boolean(member.userId?.trim());
}

/** Hourglass vs green check — connection phase for roster UI. */
export function memberConnectionPhase(
  member: HouseholdMember | null | undefined
): MemberConnectionPhase {
  if (!member) return 'awaiting';
  if (CONNECTED_OWNER(member)) return 'connected';
  if (member.status === 'pending') return 'pending_approval';
  if (member.status === 'invited') return 'awaiting';
  if (isMemberFullyConnected(member)) return 'connected';
  return 'awaiting';
}

function CONNECTED_OWNER(member: HouseholdMember): boolean {
  return member.role === 'owner' && member.status === 'active';
}

/** Short label under a member name in roster / Settings. */
export function memberConnectionLabel(member: HouseholdMember): string {
  switch (memberConnectionPhase(member)) {
    case 'connected':
      return 'Connected';
    case 'pending_approval':
      return 'Waiting for approval';
    default:
      return 'Not connected yet';
  }
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
