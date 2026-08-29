/**
 * Join policy — how new members enter the household.
 *
 * Product model (two layers):
 * 1. Household policy: review each join (default) vs automatic entry.
 * 2. Member trust: when reviewing, skip review for a specific invited person.
 */

import { memberConnectionPhase } from '@/lib/household/member-connection';
import type { HouseholdMember, HouseholdSnapshot } from '@/types/orbit';

export type JoinPolicyMode = 'review' | 'automatic';

export function getJoinPolicyMode(household: Pick<HouseholdSnapshot, 'joinApprovalRequired'>): JoinPolicyMode {
  return household.joinApprovalRequired === false ? 'automatic' : 'review';
}

export function isReviewJoinPolicy(household: Pick<HouseholdSnapshot, 'joinApprovalRequired'>): boolean {
  return getJoinPolicyMode(household) === 'review';
}

/** Per-member trust only applies while the household reviews joins. */
export function canTrustMemberForAutoJoin(
  member: HouseholdMember,
  household: Pick<HouseholdSnapshot, 'joinApprovalRequired'>
): boolean {
  if (!isReviewJoinPolicy(household)) return false;
  if (member.role === 'owner' || member.role === 'shared-device') return false;
  return member.status === 'invited' || member.status === 'pending';
}

export function memberIsTrusted(member: HouseholdMember): boolean {
  return member.joinPreApproved === true;
}

export type MembersScreenCounts = {
  pending: number;
  awaiting: number;
  connected: number;
  trustedAwaiting: number;
};

export function countMembersForMembersScreen(members: HouseholdMember[]): MembersScreenCounts {
  let pending = 0;
  let awaiting = 0;
  let connected = 0;
  let trustedAwaiting = 0;

  for (const member of members) {
    const phase = memberConnectionPhase(member);
    if (phase === 'pending_approval') pending += 1;
    else if (phase === 'awaiting') {
      awaiting += 1;
      if (member.joinPreApproved) trustedAwaiting += 1;
    } else if (phase === 'connected') connected += 1;
  }

  return { pending, awaiting, connected, trustedAwaiting };
}

/** Header subtitle — tells the admin what needs attention, or confirms all is well. */
export function membersScreenStatusLine(
  counts: MembersScreenCounts,
  policy: JoinPolicyMode,
  adminSeatsLabel?: string
): string {
  if (counts.pending > 0) {
    return counts.pending === 1
      ? '1 person is waiting for your approval.'
      : `${counts.pending} people are waiting for your approval.`;
  }
  if (counts.awaiting > 0) {
    const inviteLine =
      counts.awaiting === 1
        ? '1 person still needs their invite.'
        : `${counts.awaiting} people still need their invite.`;
    if (policy === 'review' && counts.trustedAwaiting > 0) {
      return `${inviteLine} ${counts.trustedAwaiting} will join without review.`;
    }
    return inviteLine;
  }
  if (adminSeatsLabel) return adminSeatsLabel;
  return policy === 'automatic'
    ? 'Anyone with an invite can join immediately.'
    : 'Everyone is connected.';
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
  reviewToggleLabel: 'Review new members',
  reviewToggleOn: 'You approve each person when they accept their invite.',
  reviewToggleOff: 'Anyone with an invite joins immediately — no review step.',
  trustRowLabel: 'Join without review',
  trustRowHint: (name: string) =>
    `${name} will enter as soon as they accept their invite — you won't need to approve.`,
  trustRowOffHint: (name: string) =>
    `${name} will wait for your approval after accepting their invite.`,
  sectionPolicyHeader: 'Join access',
  sectionNeedsInvite: 'Needs invite',
  sectionNeedsInviteHint: "Share each person's invite so they can connect on their device.",
  sectionPending: 'Waiting for you',
  sectionInHousehold: 'In your household',
  everyoneConnectedTitle: "Everyone's connected",
  everyoneConnectedBody: 'Turn off review for any future invites, or leave it on if you expect more people.',
  lockInvitesAction: 'Done with invites',
} as const;
