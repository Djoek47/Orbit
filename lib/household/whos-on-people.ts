/**
 * Faces shown in the Tasks “Who's on” view filter (not a full account switch).
 * Shared tablet: hosted people (2–6). Otherwise: active kids / Sidekicks.
 */
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

export function whosOnPeople(input: {
  members: readonly HouseholdMember[];
  currentMemberId?: string | null;
  hostedMemberIds?: readonly string[];
}): HouseholdMember[] {
  const { members, currentMemberId, hostedMemberIds } = input;

  if (hostedMemberIds && hostedMemberIds.length > 0) {
    const hosted = hostedMemberIds
      .map((id) => members.find((member) => member.id === id))
      .filter((member): member is HouseholdMember =>
        Boolean(
          member &&
            member.status === 'active' &&
            !isSharedDeviceRole(member.role) &&
            member.role !== 'guest'
        )
      );
    if (hosted.length > 0) return hosted.slice(0, 6);
  }

  const current = currentMemberId
    ? members.find((member) => member.id === currentMemberId)
    : undefined;
  const shell =
    (currentMemberId ? findSharedDeviceForMember(currentMemberId, members as HouseholdMember[]) : null) ??
    (current && isSharedDeviceRole(current.role) ? current : null);

  if (shell) {
    const people = resolveSharedDevicePeople(shell, members as HouseholdMember[]);
    if (people.length > 0) return people.slice(0, 6);
  }

  return members
    .filter(
      (member) =>
        member.status === 'active' &&
        (member.role === 'child' || Boolean(member.profileInviteCode?.trim())) &&
        !isSharedDeviceRole(member.role)
    )
    .slice(0, 6);
}
