import { memberConnectionLabel, memberConnectionPhase } from '@/lib/household/member-connection';
import { memberUsesProfileInvite } from '@/lib/household/member-invite-routing';
import type { HouseholdMember } from '@/types/orbit';

/** Sidekick considered live when seen within this window. */
export const MEMBER_LIVE_MS = 5 * 60 * 1000;

function formatLastSeen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const deltaMs = Date.now() - then;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Roster status line — Connected, Disconnected · last seen, or Needs invite. */
export function memberPresenceLabel(member: HouseholdMember): string {
  const usesPresence = member.role === 'child' || memberUsesProfileInvite(member);
  if (!usesPresence) {
    return memberConnectionLabel(member);
  }

  if (memberConnectionPhase(member) === 'awaiting') {
    return 'Needs invite';
  }

  const lastSeen = member.lastSeenAt?.trim();
  if (!lastSeen) {
    return 'Not connected yet';
  }

  const ageMs = Date.now() - new Date(lastSeen).getTime();
  if (!Number.isNaN(ageMs) && ageMs <= MEMBER_LIVE_MS) {
    return 'Connected';
  }

  return `Disconnected · Last seen ${formatLastSeen(lastSeen)}`;
}

export function memberIsLive(member: HouseholdMember): boolean {
  const lastSeen = member.lastSeenAt?.trim();
  if (!lastSeen) return false;
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  return !Number.isNaN(ageMs) && ageMs <= MEMBER_LIVE_MS;
}
