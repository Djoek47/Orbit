/**
 * What Settings looks like for someone who isn't an admin.
 *
 * Three shapes, one screen:
 *   sidekick        a Sidekick's own phone
 *   shared-account  a person on a shared device (they tapped their face)
 *   shared-device   the shared device itself, before anyone has
 *
 * Pure, so the rules can be tested without React Native. "Lock app" used to sit here on a
 * personal phone; it only re-showed the face picker on a device with one face, so it is gone.
 */
import { normalizeSharedDeviceLabel } from '@/lib/device/profile-picker-layout';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import type { HouseholdMember } from '@/types/orbit';

export type MemberSettingsKind = 'sidekick' | 'shared-account' | 'shared-device';

export type MemberSettingsModel = {
  kind: MemberSettingsKind;
  /** The shared device's name, when this is one. */
  deviceName?: string;
  /** Everyone who shares that device, in roster order. */
  sharedWith: string[];
  /** Show "Switch who's on". */
  canSwitchProfiles: boolean;
  /** Whose look the palette changes — their own, or the whole device's. */
  lookNote: string;
  signOut: {
    label: string;
    title: string;
    body: string;
    confirm: string;
  };
};

/** True when this screen (rather than the admin one) should be shown. */
export function usesMemberSettings(role: string | undefined | null): boolean {
  return isSidekickRole(role) || role === 'shared-device';
}

function listNames(names: string[]): string {
  if (names.length === 0) return 'everyone on it';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function memberSettingsModel(input: {
  member: Pick<HouseholdMember, 'id' | 'name' | 'role'> | null | undefined;
  members: HouseholdMember[];
  /**
   * True when this physical device is a shared-tablet session.
   * Roster link alone must not turn a personal Sidekick phone into Switch Settings.
   */
  onSharedTablet?: boolean;
}): MemberSettingsModel | null {
  const { member, members, onSharedTablet = false } = input;
  if (!member) return null;

  // The shared device itself: nobody has tapped a face yet.
  if (isSharedDeviceRole(member.role)) {
    const deviceName = normalizeSharedDeviceLabel(member.name);
    const people = resolveSharedDevicePeople(
      members.find((m) => m.id === member.id),
      members
    ).map((person) => person.name);
    return {
      kind: 'shared-device',
      deviceName,
      sharedWith: people,
      canSwitchProfiles: true,
      lookNote: 'Colors here are the ones everyone sees until they tap their face.',
      signOut: {
        label: 'Sign this device out',
        title: `Sign ${deviceName} out?`,
        body: `This signs the whole device out, for ${listNames(people)}. Everyone's tasks, XP and streaks stay saved, and you will need the household code to set it up again.`,
        confirm: 'Sign the device out',
      },
    };
  }

  const device = findSharedDeviceForMember(member.id, members);
  // Linked to Kitchen iPad AND currently on that tablet → shared-account + Switch.
  if (device && onSharedTablet) {
    const deviceName = normalizeSharedDeviceLabel(device.name);
    const people = resolveSharedDevicePeople(device, members)
      .map((person) => person.name)
      .filter((name) => name !== member.name);
    return {
      kind: 'shared-account',
      deviceName,
      sharedWith: people,
      canSwitchProfiles: true,
      lookNote: `Colors follow your face on ${deviceName} — Day and Night included.`,
      signOut: {
        label: 'Sign this device out',
        title: `Sign ${deviceName} out?`,
        body: people.length
          ? `This signs the whole device out, not just you — ${listNames(people)} would be signed out too. To hand it over, use Switch who’s on instead.`
          : 'This signs the whole device out. To hand it over to someone else, use Switch who’s on instead.',
        confirm: 'Sign the device out',
      },
    };
  }

  // Personal Sidekick phone (even if also roster-linked to a tablet).
  return {
    kind: 'sidekick',
    sharedWith: [],
    canSwitchProfiles: false,
    lookNote: 'Colors follow you on this device — Day and Night included.',
    signOut: {
      label: 'Sign out',
      title: 'Sign out?',
      body: 'You will show as disconnected on the household roster. Tap Continue as you on the welcome screen to come back — your streak and tasks stay saved.',
      confirm: 'Sign out',
    },
  };
}
