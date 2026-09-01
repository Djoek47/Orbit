import { memberConnectionLabel, memberConnectionPhase } from '@/lib/household/member-connection';
import { memberUsesProfileInvite } from '@/lib/household/member-invite-routing';
import type { HouseholdMember } from '@/types/orbit';

/** Sidekick considered live when seen within this window. */
export const MEMBER_LIVE_MS = 5 * 60 * 1000;

export function formatLastSeen(iso: string): string {
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

export type MemberPresenceParts = {
  connectionLabel: string;
  lastSeenText: string | null;
  isLive: boolean;
};

/** Split presence for meta line vs invite-row timestamp. */
export function memberPresenceParts(member: HouseholdMember): MemberPresenceParts {
  const usesPresence = member.role === 'child' || memberUsesProfileInvite(member);
  if (!usesPresence) {
    return {
      connectionLabel: memberConnectionLabel(member),
      lastSeenText: null,
      isLive: false,
    };
  }

  if (memberConnectionPhase(member) === 'awaiting') {
    return { connectionLabel: 'Needs invite', lastSeenText: null, isLive: false };
  }

  const lastSeen = member.lastSeenAt?.trim();
  if (!lastSeen) {
    return { connectionLabel: 'Not connected yet', lastSeenText: null, isLive: false };
  }

  const ageMs = Date.now() - new Date(lastSeen).getTime();
  const isLive = !Number.isNaN(ageMs) && ageMs <= MEMBER_LIVE_MS;
  return {
    connectionLabel: isLive ? 'Connected' : 'Disconnected',
    lastSeenText: formatLastSeen(lastSeen),
    isLive,
  };
}

/** Roster status line — Connected, Disconnected, or Needs invite. */
export function memberPresenceLabel(member: HouseholdMember): string {
  const { connectionLabel, lastSeenText, isLive } = memberPresenceParts(member);
  if (lastSeenText && !isLive && connectionLabel === 'Disconnected') {
    return `${connectionLabel} · Last seen ${lastSeenText}`;
  }
  return connectionLabel;
}

export function memberIsLive(member: HouseholdMember): boolean {
  return memberPresenceParts(member).isLive;
}
