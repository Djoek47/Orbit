/**
 * "Set up a device for a Sidekick" — who that device is for.
 *
 * The row used to drop you on the Settings root to find your own way. Now it goes straight to a
 * QR: when exactly one Sidekick still has no device, it's theirs; when several do, you pick from
 * the roster first; when none do, there is nothing to set up.
 *
 * Pure, so the choice can be tested without React Native.
 */
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import type { HouseholdMember } from '@/types/orbit';

export type SidekickSetupTarget =
  | { kind: 'none' }
  | { kind: 'pick'; waiting: HouseholdMember[] }
  | { kind: 'member'; member: HouseholdMember };

/**
 * A Sidekick is on a device once their profile code has been redeemed — the roster turns them
 * from 'invited' to 'active', and lastSeenAt is stamped the first time they open the app.
 */
export function sidekickHasDevice(member: HouseholdMember): boolean {
  return member.status === 'active' || Boolean(member.lastSeenAt);
}

/** Sidekicks on the roster, device or not. */
export function sidekickMembers(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) =>
      isSidekickRole(member.role) &&
      !isSharedDeviceRole(member.role) &&
      member.status !== 'inactive'
  );
}

export function sidekickSetupTarget(members: HouseholdMember[]): SidekickSetupTarget {
  const sidekicks = sidekickMembers(members);
  if (sidekicks.length === 0) return { kind: 'none' };
  const waiting = sidekicks.filter((member) => !sidekickHasDevice(member));
  if (waiting.length === 1) return { kind: 'member', member: waiting[0]! };
  if (waiting.length > 1) return { kind: 'pick', waiting };
  // Everyone is on a device already — still let them re-show a code from the roster.
  return { kind: 'pick', waiting: sidekicks };
}

/** Where the Getting started row goes. */
export function sidekickSetupRoute(target: SidekickSetupTarget): string {
  if (target.kind === 'member') return `/settings?section=members&invite=${target.member.id}`;
  if (target.kind === 'pick') return '/settings?section=members&invite=pick';
  return '/settings?section=members&add=1';
}
