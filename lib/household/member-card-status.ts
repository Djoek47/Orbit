/**
 * Visible next-step status for Settings member cards (WO6 §B4).
 */
import { memberConnectionPhase } from '@/lib/household/member-connection';
import { memberPresenceParts } from '@/lib/household/member-presence';
import { memberUsesProfileInvite } from '@/lib/household/member-invite-routing';
import { findSharedDeviceForMember } from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

export type MemberCardAction = 'setup_device' | 'show_code' | 'share_invite' | 'approve' | 'manage' | null;

export type MemberCardStatus = {
  line: string;
  actionLabel: string | null;
  action: MemberCardAction;
};

export function memberCardStatus(
  member: HouseholdMember,
  members: HouseholdMember[]
): MemberCardStatus {
  const presence = memberPresenceParts(member);
  const phase = memberConnectionPhase(member);
  const sharedDevice = findSharedDeviceForMember(member.id, members);
  const isChild = member.role === 'child' || memberUsesProfileInvite(member);

  if (isChild) {
    if (sharedDevice) {
      return {
        line: `On ${sharedDevice.name || 'the shared device'}`,
        actionLabel: null,
        action: null,
      };
    }
    if (phase === 'awaiting' || presence.connectionLabel === 'Needs invite' || presence.connectionLabel === 'Not connected yet') {
      return {
        line: 'Not set up yet',
        actionLabel: 'Set up device',
        action: 'setup_device',
      };
    }
    if (presence.connectionLabel === 'Connected' || presence.connectionLabel === 'Disconnected') {
      return {
        line: 'On their phone',
        actionLabel: 'Show code',
        action: 'show_code',
      };
    }
    return {
      line: 'Not set up yet',
      actionLabel: 'Set up device',
      action: 'setup_device',
    };
  }

  // Adult / admin / owner
  if (member.status === 'pending') {
    return {
      line: 'Waiting for you to approve',
      actionLabel: 'Approve',
      action: 'approve',
    };
  }
  if (phase === 'awaiting' || member.status === 'invited') {
    return {
      line: 'Waiting for them to join',
      actionLabel: 'Share invite',
      action: 'share_invite',
    };
  }
  if (phase === 'connected') {
    return {
      line: 'Signed in',
      actionLabel: null,
      action: 'manage',
    };
  }
  return {
    line: presence.connectionLabel,
    actionLabel: memberCanShare(member) ? 'Share invite' : null,
    action: memberCanShare(member) ? 'share_invite' : null,
  };
}

function memberCanShare(member: HouseholdMember): boolean {
  return member.status === 'invited' || member.status === 'pending' || !member.userId;
}
