/**
 * One way onto a shared device.
 *
 * There used to be two. The device's QR joined through join-shared-device, which saves a
 * session for every person on it. One person's own code, when that person was on a shared
 * device, joined through join-profile, which saved a session for that person only — so the
 * tablet showed every face and then refused all but one: "Emma is not on this tablet yet".
 *
 * Now a personal code that belongs to a shared device is turned into the device's link, and
 * everything goes through join-shared-device.
 *
 * Pure: no React Native, no storage.
 */
import { buildSharedDeviceInviteLink } from '@/lib/household/shared-device-invite';
import { findSharedDeviceForMember } from '@/lib/household/shared-device';
import { normalizeInviteCode } from '@/lib/invites/parse-invite';
import type { SharedDeviceRoster } from '@/repositories/household-repository';
import type { HouseholdMember } from '@/types/orbit';

/** The device a member is on, from the local roster — used when the server did not say. */
export function rosterFromMembers(
  memberId: string | null | undefined,
  members: HouseholdMember[]
): SharedDeviceRoster | null {
  const shell = findSharedDeviceForMember(memberId ?? undefined, members);
  if (!shell) return null;
  return {
    id: shell.id,
    name: shell.name,
    people: (shell.sharedWithMemberIds ?? [])
      .map((id) => members.find((m) => m.id === id))
      .filter(
        (m): m is HouseholdMember => Boolean(m && (m.status === 'active' || m.status === 'invited'))
      )
      .map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar ?? null,
        profileInviteCode: m.profileInviteCode ?? null,
      })),
  };
}

/**
 * Every code on the device that this phone knows, the scanned one always included, each once.
 *
 * On a fresh tablet that is only the scanned code — the public lookup never returns anyone
 * else's — and the tablet joins as that one person, with only that face on the picker. Every
 * face it shows opens. The device's own QR (People → Show the code) carries everyone.
 */
export function deviceCodes(scannedCode: string, roster: SharedDeviceRoster | null): string[] {
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const code = raw?.trim() ? normalizeInviteCode(raw) : '';
    if (code && !out.includes(code)) out.push(code);
  };
  for (const person of roster?.people ?? []) add(person.profileInviteCode);
  add(scannedCode);
  return out;
}

/**
 * Where a personal code that belongs to a shared device should go: the device's own join
 * screen, carrying everyone's codes. `personal` remembers the scanned code so that screen can
 * still offer "use this phone as Jack's own".
 */
export function sharedDeviceHrefForCode(
  scannedCode: string,
  roster: SharedDeviceRoster | null
): string {
  const link = buildSharedDeviceInviteLink({
    label: roster?.name?.trim() || 'Shared device',
    codes: deviceCodes(scannedCode, roster),
  });
  const params = [`payload=${encodeURIComponent(link)}`, `personal=${encodeURIComponent(scannedCode)}`];
  if (roster?.id) params.push(`deviceId=${encodeURIComponent(roster.id)}`);
  return `/join-shared-device?${params.join('&')}`;
}
