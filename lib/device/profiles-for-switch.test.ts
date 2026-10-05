/**
 * Run: npx tsx lib/device/profiles-for-switch.test.ts
 *
 * Switch must list the same faces as Settings → Shared tablets → On this device.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DeviceSession } from '@/lib/device/device-session';
import {
  profilesForSharedDeviceSwitch,
  resolveSwitchDeviceShell,
} from '@/lib/device/profiles-for-switch';
import type { HouseholdMember } from '@/types/orbit';

function person(
  id: string,
  name: string,
  role: HouseholdMember['role'],
  extra: Partial<HouseholdMember> = {}
): HouseholdMember {
  return {
    id,
    name,
    role,
    status: 'active',
    xp: 0,
    avatar: '',
    ...extra,
  } as HouseholdMember;
}

const emma = person('e', 'Emma', 'child');
const jack = person('j', 'Jack', 'child');
const owner = person('o', 'Ada', 'owner');
const testTablet = person('d', 'Test', 'shared-device', {
  sharedWithMemberIds: ['e', 'j'],
});
const members = [owner, emma, jack, testTablet];

// Only Emma hosted locally — Switch still shows Emma + Jack from roster.
{
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'sidekick',
    profileMemberIds: ['e'],
    activeMemberId: 'e',
    needsProfilePick: true,
    deviceLabel: "Emma's device",
    sharedDeviceId: null,
  };
  const faces = profilesForSharedDeviceSwitch(session, members);
  assert.deepEqual(
    faces.map((m) => m.name),
    ['Emma', 'Jack'],
    'roster people win over a one-id device session'
  );
  assert.equal(resolveSwitchDeviceShell(session, members)?.name, 'Test');
}

// Explicit sharedDeviceId.
{
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'shared-tablet',
    profileMemberIds: ['e'],
    activeMemberId: 'e',
    needsProfilePick: true,
    deviceLabel: 'Test',
    sharedDeviceId: 'd',
  };
  assert.deepEqual(
    profilesForSharedDeviceSwitch(session, members).map((m) => m.name),
    ['Emma', 'Jack']
  );
}

// True personal Sidekick — no shared tablet shell → only the hosted face.
{
  const lone = person('k', 'Kai', 'child');
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'sidekick',
    profileMemberIds: ['k'],
    activeMemberId: 'k',
    needsProfilePick: false,
    deviceLabel: "Kai's device",
  };
  assert.deepEqual(
    profilesForSharedDeviceSwitch(session, [owner, lone]).map((m) => m.name),
    ['Kai']
  );
}

const screen = readFileSync(join(process.cwd(), 'app/select-profile.tsx'), 'utf8');
assert.match(screen, /profilesForSharedDeviceSwitch/, 'select-profile uses roster merge');
assert.match(screen, /alignSessionWithRoster/, 'session expands to roster faces');
assert.match(screen, /showPersonalSplash/, 'splash gated for personal one-face only');
assert.doesNotMatch(
  screen,
  /sidekickUnlock && profiles\.length === 1/,
  'old splash gate removed'
);

console.log('profiles-for-switch: ok');
