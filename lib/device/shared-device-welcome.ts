/**
 * What the welcome card shows after a shared-device QR is scanned.
 *
 * The old screen asked "Which device?" and offered "Continue as Emma's Sidekick phone" — a
 * question the QR had already answered, phrased in words no parent standing in a kitchen
 * would follow. This replaces the question with a confirmation: the household you are about
 * to join, the device's name, a short code to check against the admin's screen, and who is
 * already on it.
 *
 * Pure: no React Native, no storage.
 */
import {
  resolveSharedDevicePeople,
  SHARED_DEVICE_MAX_PEOPLE,
} from '@/lib/household/shared-device';
import { normalizeSharedDeviceLabel } from '@/lib/device/profile-picker-layout';
import type { HouseholdMember } from '@/types/orbit';

/** Unambiguous by eye: no O/0, I/1, S/5, B/8. */
const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY234679';

/**
 * A four-character code for a household, the same every time.
 *
 * It proves nothing cryptographically and is not meant to — it is there so someone holding
 * the tablet and someone holding the admin's phone can see the same four characters and know
 * they scanned the right house. Derived from the household id so both ends compute it without
 * talking to each other.
 */
export function householdMatchCode(householdId: string | null | undefined): string {
  const seed = (householdId ?? '').trim();
  if (!seed) return '----';
  // FNV-1a, 32-bit. Small, stable, and good enough to scatter ids across the alphabet.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length) + 7919 * (i + 1);
  }
  return out;
}

export type SharedDeviceWelcome = {
  householdName: string;
  deviceLabel: string;
  matchCode: string;
  /** Everyone already on the tablet, capped at what the picker can lay out. */
  people: HouseholdMember[];
  /** "Emma and Jack" · "Emma, Jack and 2 others" — never a bare list that runs off screen. */
  peopleLabel: string;
  full: boolean;
};

/** "Emma and Jack", "Emma, Jack and 2 others", "" when nobody is on it yet. */
export function describePeople(people: HouseholdMember[]): string {
  const names = people.map((p) => p.name.trim().split(/\s+/)[0] || p.name.trim()).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} other${rest === 1 ? '' : 's'}`;
}

export function sharedDeviceWelcome(input: {
  householdId: string | null | undefined;
  householdName: string | null | undefined;
  shell: HouseholdMember | null | undefined;
  members: HouseholdMember[];
}): SharedDeviceWelcome {
  const people = resolveSharedDevicePeople(input.shell, input.members).slice(
    0,
    SHARED_DEVICE_MAX_PEOPLE
  );
  return {
    householdName: input.householdName?.trim() || 'your household',
    deviceLabel: normalizeSharedDeviceLabel(input.shell?.name),
    matchCode: householdMatchCode(input.householdId),
    people,
    peopleLabel: describePeople(people),
    full: people.length >= SHARED_DEVICE_MAX_PEOPLE,
  };
}
