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

export type MemberPresenceChannel = 'personal' | 'shared' | 'any';

function liveFromIso(iso: string | null | undefined): {
  isLive: boolean;
  lastSeenText: string | null;
} {
  const lastSeen = iso?.trim();
  if (!lastSeen) {
    return { isLive: false, lastSeenText: null };
  }
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  const isLive = !Number.isNaN(ageMs) && ageMs <= MEMBER_LIVE_MS;
  return { isLive, lastSeenText: formatLastSeen(lastSeen) };
}

/**
 * Presence for admin People.
 * - personal: SIDEKICKS list (phone only)
 * - shared: Shared tablets “Who can use it” (active face on that device)
 * - any: legacy / detail screens (either channel)
 */
export function memberPresenceParts(
  member: HouseholdMember,
  options?: { channel?: MemberPresenceChannel; sharedDeviceId?: string | null }
): MemberPresenceParts {
  const channel = options?.channel ?? 'any';
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

  if (channel === 'personal') {
    const stamp = member.personalLastSeenAt ?? null;
    // Before migration backfill lands on client, avoid treating shared-only
    // lastSeenAt as personal Connected when they are active on a tablet.
    const { isLive, lastSeenText } = liveFromIso(stamp);
    if (isLive) {
      return { connectionLabel: 'Connected', lastSeenText, isLive: true };
    }
    // Fallback: old clients only had lastSeenAt — show Connected only if not
    // marked active on a shared tablet right now.
    if (!stamp && member.lastSeenAt && !member.sharedActiveOnDeviceId) {
      const legacy = liveFromIso(member.lastSeenAt);
      return {
        connectionLabel: legacy.isLive ? 'Connected' : 'Disconnected',
        lastSeenText: legacy.lastSeenText,
        isLive: legacy.isLive,
      };
    }
    return {
      connectionLabel: lastSeenText || stamp ? 'Disconnected' : 'Not connected yet',
      lastSeenText,
      isLive: false,
    };
  }

  if (channel === 'shared') {
    const deviceId = options?.sharedDeviceId?.trim();
    const activeHere =
      Boolean(deviceId) && member.sharedActiveOnDeviceId === deviceId;
    const stamp = member.sharedLastSeenAt ?? (activeHere ? member.lastSeenAt : null);
    const { isLive, lastSeenText } = liveFromIso(stamp);
    if (activeHere && isLive) {
      return { connectionLabel: 'Connected', lastSeenText, isLive: true };
    }
    return {
      connectionLabel: lastSeenText ? 'Disconnected' : 'Not connected yet',
      lastSeenText,
      isLive: false,
    };
  }

  // any — either channel live
  const personal = liveFromIso(member.personalLastSeenAt ?? member.lastSeenAt);
  const shared = liveFromIso(member.sharedLastSeenAt);
  const isLive = personal.isLive || shared.isLive;
  const lastSeenText = personal.lastSeenText ?? shared.lastSeenText;
  if (!member.personalLastSeenAt && !member.sharedLastSeenAt && !member.lastSeenAt) {
    return { connectionLabel: 'Not connected yet', lastSeenText: null, isLive: false };
  }
  return {
    connectionLabel: isLive ? 'Connected' : 'Disconnected',
    lastSeenText,
    isLive,
  };
}

/** SIDEKICKS list — personal phone channel only. */
export function personalPresenceParts(member: HouseholdMember): MemberPresenceParts {
  return memberPresenceParts(member, { channel: 'personal' });
}

/** Shared tablets “Who can use it” — active face on this device. */
export function sharedPresenceParts(
  member: HouseholdMember,
  sharedDeviceId: string | null | undefined
): MemberPresenceParts {
  return memberPresenceParts(member, { channel: 'shared', sharedDeviceId });
}

/** Roster status line — Connected, Disconnected, or Needs invite. */
export function memberPresenceLabel(
  member: HouseholdMember,
  options?: { channel?: MemberPresenceChannel; sharedDeviceId?: string | null }
): string {
  const { connectionLabel, lastSeenText, isLive } = memberPresenceParts(member, options);
  if (lastSeenText && !isLive && connectionLabel === 'Disconnected') {
    return `${connectionLabel} · Last seen ${lastSeenText}`;
  }
  return connectionLabel;
}

export function memberIsLive(
  member: HouseholdMember,
  options?: { channel?: MemberPresenceChannel; sharedDeviceId?: string | null }
): boolean {
  return memberPresenceParts(member, options).isLive;
}
