import type { DeviceSession } from '@/lib/device/device-session';
import type { HouseholdMember } from '@/types/orbit';

export type DeviceHostKind = 'sidekick' | 'shared-tablet';

/** Personal Sidekick phone/tablet — not a multi-profile shared iPad. */
export function isPersonalSidekickDevice(
  session: DeviceSession | null,
  profiles: HouseholdMember[]
): boolean {
  if (!session) return false;
  if (session.hostKind === 'sidekick') return true;
  if (session.hostKind === 'shared-tablet') return false;
  if (profiles.length !== 1) return false;
  const member = profiles[0];
  if (member.role !== 'child') return false;
  return !session.sharedDeviceId;
}
