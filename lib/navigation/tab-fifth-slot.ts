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
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import type { HouseholdMember } from '@/types/orbit';

export type TabFifthSlot = 'poppins' | 'switch' | 'none';

export function tabFifthSlot(input: {
  role: HouseholdMember['role'] | undefined | null;
  members: HouseholdMember[];
  memberId?: string | null;
  /** Local device binding — roster link is not always present for hosted profiles. */
  sharedTabletSession?: boolean;
}): TabFifthSlot {
  const { role, sharedTabletSession } = input;

  // Household admins always keep Poppins on their own phone — never Switch.
  if (role === 'owner' || role === 'admin') return 'poppins';

  if (sharedTabletSession) return 'switch';

  // The shared device shell, before anyone has tapped a face.
  if (isSharedDeviceRole(role)) return 'switch';

  // Sidekick personal phones never get Switch — even if that person is also
  // linked to a Kitchen iPad roster. Switch is the shared-tablet session only.
  if (isSidekickRole(role)) return 'none';

  return 'poppins';
}
