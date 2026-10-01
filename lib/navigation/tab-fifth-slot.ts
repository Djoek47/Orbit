/**
 * What sits in the tab bar's fifth slot.
 *
 * It used to be Poppins for everyone, which was wrong twice over: a Sidekick has no Poppins at
 * all (so the slot was a button to nowhere), and on a shared iPad the thing people reach for is
 * "hand this to someone else", which was buried in Settings.
 *
 *   'poppins'  an adult on their own device
 *   'switch'   a shared tablet — swap who's on
 *   'none'     a Sidekick's own phone: four tabs, and no fifth
 *
 * Pure, so the rule is testable without React Native.
 */
import { findSharedDeviceForMember, isSharedDeviceRole } from '@/lib/household/shared-device';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import type { HouseholdMember } from '@/types/orbit';

export type TabFifthSlot = 'poppins' | 'switch' | 'none';

export function tabFifthSlot(input: {
  role: HouseholdMember['role'] | undefined | null;
  members: HouseholdMember[];
  memberId?: string | null;
}): TabFifthSlot {
  const { role, members, memberId } = input;

  // The iPad itself, before anyone has tapped a face.
  if (isSharedDeviceRole(role)) return 'switch';

  // Someone on a shared iPad: handing it over is the fifth button.
  if (memberId && findSharedDeviceForMember(memberId, members)) return 'switch';

  // A Sidekick's own phone has no Poppins, so it has no fifth tab either.
  if (isSidekickRole(role)) return 'none';

  return 'poppins';
}
