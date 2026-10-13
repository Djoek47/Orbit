/**
 * Faces for Switch / Who's using this device?
 * Same source as Settings → Shared tablets → On this device.
 */
import type { DeviceSession } from '@/lib/device/device-session';
import {
  findSharedDeviceForMember,
  listSharedDevices,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

function activeMember(
  id: string,
  members: HouseholdMember[]
): HouseholdMember | undefined {
  const member = members.find((item) => item.id === id);
  return member && member.status === 'active' ? member : undefined;
}

/** Shared-device shell that owns the people on this physical device. */
export function resolveSwitchDeviceShell(
  session: DeviceSession | null,
  members: HouseholdMember[]
): HouseholdMember | undefined {
  // Personal Sidekick phone — never inherit a Kitchen iPad shell from roster links.
  if (session?.hostKind === 'sidekick' && !session.sharedDeviceId) {
    return undefined;
  }

  if (session?.sharedDeviceId) {
    const byId = members.find((m) => m.id === session.sharedDeviceId);
    if (byId?.role === 'shared-device' && byId.status === 'active') return byId;
  }

  for (const id of session?.profileMemberIds ?? []) {
    const shell = findSharedDeviceForMember(id, members);
    if (shell) return shell;
  }

  // Do **not** fall back to “the only shared device in the household”.
  // That wrongly turned a personal admin phone into a Switch tablet just because
  // a Kitchen iPad shell exists in the roster.
  if (
    session?.mode === 'shared' ||
    session?.hostKind === 'shared-tablet' ||
    session?.sharedDeviceId
  ) {
    const shells = listSharedDevices(members);
    if (shells.length === 1) return shells[0];
  }
  return undefined;
}

/**
 * People shown on Switch — roster links first (Settings parity), then any
 * extra profiles hosted only in the local device session.
 */
export function profilesForSharedDeviceSwitch(
  session: DeviceSession | null,
  members: HouseholdMember[]
): HouseholdMember[] {
  const shell = resolveSwitchDeviceShell(session, members);
  const roster = shell ? resolveSharedDevicePeople(shell, members) : [];
  const rosterIds = new Set(roster.map((person) => person.id));

  const hostedExtras: HouseholdMember[] = [];
  if (session?.mode === 'shared') {
    for (const id of session.profileMemberIds) {
      if (rosterIds.has(id)) continue;
      const member = activeMember(id, members);
      if (member) hostedExtras.push(member);
    }
  }

  if (roster.length > 0 || hostedExtras.length > 0) {
    return [...roster, ...hostedExtras];
  }

  if (session?.mode === 'shared' && session.profileMemberIds.length > 0) {
    return session.profileMemberIds
      .map((id) => activeMember(id, members))
      .filter((m): m is HouseholdMember => Boolean(m));
  }

  return [];
}
