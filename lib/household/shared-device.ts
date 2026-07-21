import type { HouseholdMember } from '@/types/orbit';

export function isSharedDeviceRole(role: HouseholdMember['role'] | undefined | null): boolean {
  return role === 'shared-device';
}

export function isSharedDeviceMember(member: HouseholdMember | undefined | null): boolean {
  return Boolean(member && isSharedDeviceRole(member.role));
}

/** Real people who share this device (excludes the device profile itself). */
export function resolveSharedDevicePeople(
  device: HouseholdMember | undefined | null,
  members: HouseholdMember[]
): HouseholdMember[] {
  if (!isSharedDeviceMember(device)) return [];
  const ids = new Set(device?.sharedWithMemberIds ?? []);
  return members.filter(
    (member) =>
      ids.has(member.id) &&
      member.status === 'active' &&
      !isSharedDeviceRole(member.role) &&
      member.role !== 'guest'
  );
}

/** All shared-device profiles in the household. */
export function listSharedDevices(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter((member) => member.status === 'active' && isSharedDeviceRole(member.role));
}

/** Ids of people nested under any shared device (switchable accounts). */
export function nestedSharedAccountIds(members: HouseholdMember[]): Set<string> {
  const ids = new Set<string>();
  for (const device of listSharedDevices(members)) {
    for (const personId of device.sharedWithMemberIds ?? []) {
      ids.add(personId);
    }
  }
  return ids;
}

/** Shared device this person belongs to (if any). */
export function findSharedDeviceForMember(
  memberId: string | undefined | null,
  members: HouseholdMember[]
): HouseholdMember | undefined {
  if (!memberId) return undefined;
  return listSharedDevices(members).find((device) =>
    (device.sharedWithMemberIds ?? []).includes(memberId)
  );
}

/**
 * Nested switchable account on a shared tablet (e.g. Josh / Todd).
 * These profiles get a simplified kid-friendly Home/Tasks surface.
 */
export function isSharedDeviceAccount(
  member: HouseholdMember | undefined | null,
  members: HouseholdMember[]
): boolean {
  return Boolean(member && findSharedDeviceForMember(member.id, members));
}

/**
 * Top-level assign targets: shared devices + people not nested under a device.
 * Nested accounts (Josh/Todd) are chosen after picking the Shared tablet.
 */
export function assignTargetMembers(members: HouseholdMember[]): HouseholdMember[] {
  const nested = nestedSharedAccountIds(members);
  return members.filter(
    (member) =>
      member.status === 'active' &&
      (isSharedDeviceRole(member.role) || (!nested.has(member.id) && member.role !== 'guest'))
  );
}

/** Candidates an admin can attach to a shared device. */
export function sharedDeviceLinkCandidates(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) =>
      member.status === 'active' &&
      !isSharedDeviceRole(member.role) &&
      member.role !== 'guest'
  );
}

/** Title shown on the shared device: "Clean dishes - Josh". */
export function withSharedPersonLabel(baseTitle: string, personName: string): string {
  const trimmed = baseTitle.trim();
  const suffix = ` - ${personName.trim()}`;
  if (!trimmed) return personName.trim();
  if (trimmed.endsWith(suffix)) return trimmed;
  return `${trimmed}${suffix}`;
}

export function sharedDeviceAssigneeNames(
  device: HouseholdMember | undefined | null,
  members: HouseholdMember[]
): Set<string> {
  return new Set(resolveSharedDevicePeople(device, members).map((member) => member.name));
}
