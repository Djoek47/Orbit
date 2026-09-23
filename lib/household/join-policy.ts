/**
 * Join policy — all invites connect immediately (approval flow removed).
 */

import { memberConnectionPhase } from '@/lib/household/member-connection';
import type { HouseholdMember, HouseholdSnapshot } from '@/types/orbit';

export type JoinPolicyMode = 'automatic';

export function getJoinPolicyMode(_household?: Pick<HouseholdSnapshot, 'joinApprovalRequired'>): JoinPolicyMode {
  return 'automatic';
}

export function isReviewJoinPolicy(_household?: Pick<HouseholdSnapshot, 'joinApprovalRequired'>): boolean {
  return false;
}

/** Per-member trust toggles removed — always false. */
export function canTrustMemberForAutoJoin(
  _member: HouseholdMember,
  _household?: Pick<HouseholdSnapshot, 'joinApprovalRequired'>
): boolean {
  return false;
}

export function memberIsTrusted(_member: HouseholdMember): boolean {
  return false;
}

export type MembersScreenCounts = {
  pending: number;
  awaiting: number;
  connected: number;
  trustedAwaiting: number;
};

export function countMembersForMembersScreen(members: HouseholdMember[]): MembersScreenCounts {
  let awaiting = 0;
  let connected = 0;

  for (const member of members) {
    const phase = memberConnectionPhase(member);
    if (phase === 'awaiting') awaiting += 1;
    else if (phase === 'connected') connected += 1;
  }

  return { pending: 0, awaiting, connected, trustedAwaiting: 0 };
}

/** Header subtitle — tells the admin what needs attention, or confirms all is well. */
export function membersScreenStatusLine(
  counts: MembersScreenCounts,
  _policy?: JoinPolicyMode,
  adminSeatsLabel?: string
): string {
  if (counts.awaiting > 0) {
    return counts.awaiting === 1
      ? '1 person still needs their invite.'
      : `${counts.awaiting} people still need their invite.`;
  }
  if (adminSeatsLabel) return adminSeatsLabel;
  return 'Everyone with an invite joins immediately.';
}

/** True when every non-owner member is connected — admin can lock invite period. */
export function canLockInvites(members: HouseholdMember[]): boolean {
  const roster = members.filter(
    (member) => member.role !== 'owner' && member.role !== 'shared-device'
  );
  if (roster.length === 0) return true;
  return roster.every((member) => memberConnectionPhase(member) === 'connected');
}

export const JOIN_POLICY_COPY = {
  sectionNeedsInvite: 'Needs invite',
  sectionNeedsInviteHint: "Share each person's invite so they can connect on their device.",
  sectionInHousehold: 'In your household',
} as const;
