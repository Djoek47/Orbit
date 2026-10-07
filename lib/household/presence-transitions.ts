/**
 * Detect Sidekick Connected ↔ Disconnected transitions for activity + notifications.
 */
import { memberPresenceParts } from '@/lib/household/member-presence';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

export type PresencePhase = 'live' | 'away' | 'awaiting';

export type PresenceTransition = {
  memberId: string;
  memberName: string;
  from: PresencePhase;
  to: PresencePhase;
};

function phaseFor(member: HouseholdMember): PresencePhase {
  const parts = memberPresenceParts(member);
  if (parts.isLive || parts.connectionLabel === 'Connected') return 'live';
  if (
    parts.connectionLabel === 'Needs invite' ||
    parts.connectionLabel === 'Not connected yet'
  ) {
    return 'awaiting';
  }
  return 'away';
}

/** Snapshot of presence phases keyed by member id (Sidekicks only). */
export function presenceSnapshot(members: HouseholdMember[]): Record<string, PresencePhase> {
  const out: Record<string, PresencePhase> = {};
  for (const member of members) {
    if (member.role !== 'child' || isSharedDeviceRole(member.role)) continue;
    out[member.id] = phaseFor(member);
  }
  return out;
}

/**
 * Diff previous vs next presence snapshots.
 * Skips the first snapshot (empty previous) so hydrate does not spam.
 */
export function diffPresenceTransitions(
  previous: Record<string, PresencePhase>,
  next: Record<string, PresencePhase>,
  members: HouseholdMember[]
): PresenceTransition[] {
  if (Object.keys(previous).length === 0) return [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const out: PresenceTransition[] = [];
  for (const [memberId, to] of Object.entries(next)) {
    const from = previous[memberId];
    if (!from || from === to) continue;
    const meaningful =
      (from === 'live' && to === 'away') ||
      (from === 'away' && to === 'live') ||
      (from === 'awaiting' && to === 'live') ||
      (from === 'live' && to === 'awaiting');
    if (!meaningful) continue;
    const member = byId.get(memberId);
    if (!member) continue;
    out.push({ memberId, memberName: member.name, from, to });
  }
  return out;
}

export function presenceTransitionCopy(t: PresenceTransition): { title: string; body: string } {
  if (t.to === 'live') {
    return {
      title: `${t.memberName} connected`,
      body: `${t.memberName} is active on their device.`,
    };
  }
  if (t.from === 'live') {
    return {
      title: `${t.memberName} disconnected`,
      body: `${t.memberName} is no longer active.`,
    };
  }
  return {
    title: `${t.memberName} status changed`,
    body: `${t.memberName} went from ${t.from} to ${t.to}.`,
  };
}
