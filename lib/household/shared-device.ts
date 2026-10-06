import type { HouseholdMember } from '@/types/orbit';

/** Default display name for a new shared device profile (user-facing copy). */
export const DEFAULT_SHARED_IPAD_NAME = 'Shared device';

/** Caps how many faces can share one tablet. */
export const SHARED_DEVICE_MAX_PEOPLE = 6;

export function isSharedDeviceRole(role: HouseholdMember['role'] | undefined | null): boolean {
  return role === 'shared-device';
}

export function isSharedDeviceMember(member: HouseholdMember | undefined | null): boolean {
  return Boolean(member && isSharedDeviceRole(member.role));
}

/**
 * Admins / owners run the household from their own phone — they don't sit on the shared
 * tablet roster. Sidekicks (and non-admin adults) do.
 */
export function isSharedDeviceEligiblePerson(member: HouseholdMember | undefined | null): boolean {
  if (!member || member.status !== 'active') return false;
  if (isSharedDeviceRole(member.role) || member.role === 'guest') return false;
  if (member.role === 'owner' || member.role === 'admin') return false;
  return true;
}

/** Real people who share this device (excludes the device profile and household admins). */
export function resolveSharedDevicePeople(
  device: HouseholdMember | undefined | null,
  members: HouseholdMember[]
): HouseholdMember[] {
  if (!isSharedDeviceMember(device)) return [];
  const ids = new Set(device?.sharedWithMemberIds ?? []);
  return members.filter((member) => ids.has(member.id) && isSharedDeviceEligiblePerson(member));
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
 * Nested switchable account on a shared tablet (e.g. Emma / Jack).
 * These profiles get a simplified Sidekick Home/Tasks surface.
 */
export function isSharedDeviceAccount(
  member: HouseholdMember | undefined | null,
  members: HouseholdMember[]
): boolean {
  return Boolean(member && findSharedDeviceForMember(member.id, members));
}

/**
 * Top-level assign targets: shared devices + people not nested under a device.
 * Nested accounts (Emma/Jack) are chosen after picking the Shared tablet.
 */
export function assignTargetMembers(members: HouseholdMember[]): HouseholdMember[] {
  const nested = nestedSharedAccountIds(members);
  return members.filter(
    (member) =>
      member.status === 'active' &&
      (isSharedDeviceRole(member.role) || (!nested.has(member.id) && member.role !== 'guest'))
  );
}

/** Candidates an admin can attach to a shared device (never owner / admin). */
export function sharedDeviceLinkCandidates(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(isSharedDeviceEligiblePerson);
}

/**
 * Drop owner/admin ids (and unknowns) from a device's link list.
 * Returns null when nothing needs pruning.
 */
export function pruneSharedDeviceLinks(
  linkedIds: string[] | undefined | null,
  members: HouseholdMember[]
): string[] | null {
  const eligible = new Set(sharedDeviceLinkCandidates(members).map((m) => m.id));
  const next = (linkedIds ?? []).filter((id) => eligible.has(id));
  const prev = linkedIds ?? [];
  if (next.length === prev.length && next.every((id, i) => id === prev[i])) return null;
  return next;
}

/** Title shown on the shared device: "Clean dishes - Jack". */
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
