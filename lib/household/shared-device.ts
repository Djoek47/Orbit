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

/** Candidates an admin can attach to a shared device. */
export function sharedDeviceLinkCandidates(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) =>
      member.status === 'active' &&
      !isSharedDeviceRole(member.role) &&
      member.role !== 'guest'
  );
}

/** Title shown on the shared device: "Clean dishes - David". */
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
