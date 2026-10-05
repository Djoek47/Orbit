/**
 * Who appears on the Activity / Inbox streak strip.
 * Admins see every real person; Sidekicks / shared profiles see themselves
 * (and optionally other faces hosted on the same shared device).
 */
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

export type MemberStreakRow = {
  id: string;
  name: string;
  streak: number;
  avatar: string;
  isSelf: boolean;
};

function isStreakPerson(member: HouseholdMember): boolean {
  if (member.status !== 'active') return false;
  if (isSharedDeviceRole(member.role)) return false;
  if (member.role === 'guest') return false;
  return true;
}

export function memberStreakRows(input: {
  members: readonly HouseholdMember[];
  viewerId?: string | null;
  viewerIsAdmin: boolean;
  /** Other member ids hosted on this shared tablet (optional). */
  sharedPeerIds?: readonly string[];
}): MemberStreakRow[] {
  const people = input.members.filter(isStreakPerson);
  const peerSet = new Set(input.sharedPeerIds ?? []);

  const pick = input.viewerIsAdmin
    ? people
    : people.filter(
        (member) => member.id === input.viewerId || peerSet.has(member.id)
      );

  const sorted = [...pick].sort((a, b) => {
    if (a.id === input.viewerId) return -1;
    if (b.id === input.viewerId) return 1;
    return (b.streak ?? 0) - (a.streak ?? 0) || a.name.localeCompare(b.name);
  });

  return sorted.map((member) => ({
    id: member.id,
    name: member.name,
    streak: Math.max(0, member.streak ?? 0),
    avatar: member.avatar || member.name.charAt(0).toUpperCase(),
    isSelf: member.id === input.viewerId,
  }));
}
