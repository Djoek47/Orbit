/**
 * Admin removes a Sidekick / shared-device person → notify → grace timer → kick.
 * Pure helpers so the countdown and copy stay testable.
 */

export const MEMBER_REMOVAL_GRACE_SECONDS = 12;

export const MEMBER_REMOVED_KIND = 'member_removed' as const;

export type MemberRemovalNotice = {
  title: string;
  body: string;
  category: 'members';
  priority: 'high';
  data: {
    kind: typeof MEMBER_REMOVED_KIND;
    audienceMemberIds: string[];
    removedMemberId: string;
    removedName: string;
    graceSeconds: number;
  };
};

/** Inbox + push copy when an admin removes someone. */
export function memberRemovalNotice(input: {
  removedName: string;
  removedMemberId: string;
  audienceMemberIds: string[];
  householdName?: string | null;
}): MemberRemovalNotice {
  const house = input.householdName?.trim() || 'the household';
  return {
    title: 'Removed from household',
    body: `${input.removedName} was removed from ${house}. This device will sign out in a moment.`,
    category: 'members',
    priority: 'high',
    data: {
      kind: MEMBER_REMOVED_KIND,
      audienceMemberIds: input.audienceMemberIds,
      removedMemberId: input.removedMemberId,
      removedName: input.removedName,
      graceSeconds: MEMBER_REMOVAL_GRACE_SECONDS,
    },
  };
}

/** Who should get the removal notice when this roster row is deleted. */
export function removalAudienceIds(input: {
  targetId: string;
  targetRole: string | undefined | null;
  sharedWithMemberIds?: string[] | null;
}): string[] {
  if (input.targetRole === 'shared-device') {
    const linked = (input.sharedWithMemberIds ?? []).filter(Boolean);
    return linked.length > 0 ? [...new Set(linked)] : [input.targetId];
  }
  return [input.targetId];
}

export type RemovalKickCopy = {
  title: string;
  body: string;
  countdownLabel: (secondsLeft: number) => string;
  leaveLabel: string;
};

export function removalKickCopy(removedName: string): RemovalKickCopy {
  const name = removedName.trim() || 'This profile';
  return {
    title: 'Removed from household',
    body: `${name} is no longer part of this household. You’ll be signed out — the old invite code won’t work again.`,
    countdownLabel: (secondsLeft) =>
      secondsLeft <= 0 ? 'Signing out…' : `Signing out in ${secondsLeft}s`,
    leaveLabel: 'Sign out now',
  };
}

/** True when a sidekick sync payload means the profile was deleted/removed. */
export function isSidekickRemovedSyncError(payload: { error?: string } | null | undefined): boolean {
  if (!payload?.error) return false;
  const err = payload.error.toLowerCase();
  return err === 'not_found' || err.includes('removed') || err.includes('not found');
}
