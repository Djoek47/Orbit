/**
 * Run: npx tsx lib/device/profiles-for-switch.test.ts
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

{
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'sidekick',
    profileMemberIds: ['e'],
    activeMemberId: 'e',
    needsProfilePick: true,
    deviceLabel: "Emma's device",
  };
  assert.deepEqual(
    profilesForSharedDeviceSwitch(session, members).map((m) => m.name),
    ['Emma', 'Jack']
  );
  assert.equal(resolveSwitchDeviceShell(session, members)?.name, 'Test');
}

{
  // Personal admin phone — must not inherit the household’s only shared tablet.
  const personal: DeviceSession = {
    mode: 'personal',
    profileMemberIds: [],
    activeMemberId: null,
    needsProfilePick: false,
  };
  assert.equal(
    resolveSwitchDeviceShell(personal, members),
    undefined,
    'sole shared-device shell must not attach to a personal session'
  );
  assert.deepEqual(profilesForSharedDeviceSwitch(personal, members), []);
}

const home = readFileSync(join(process.cwd(), 'app/(tabs)/index.tsx'), 'utf8');
assert.match(home, /SharedDeviceSwitchMenu/, 'Home mounts Switch · Name menu');

const menu = readFileSync(
  join(process.cwd(), 'components/orbit/shared-device-switch-menu.tsx'),
  'utf8'
);
assert.match(menu, /Switch ·/, 'chip label');
assert.match(menu, /Connected/, 'connected status chip');
assert.match(menu, /isSharedTabletDeviceSession/, 'gated to shared-tablet sessions only');
assert.match(menu, /onSwitchPersona/, 'switches face without sign-out');
assert.match(menu, /selectDeviceProfile/, 'updates device session');
assert.doesNotMatch(menu, /signOut|clearSidekickSession/, 'never signs out on switch');

const deviceSession = readFileSync(join(process.cwd(), 'lib/device/device-session.ts'), 'utf8');
assert.match(
  deviceSession,
  /demoteSharedSessionForPersonalAdmin/,
  'admin personal login can clear a leaked shared-tablet binding'
);
const homeSrc = readFileSync(join(process.cwd(), 'app/(tabs)/index.tsx'), 'utf8');
assert.match(homeSrc, /demoteSharedSessionForPersonalAdmin/);

const bar = readFileSync(join(process.cwd(), 'components/orbit/make-tab-bar.tsx'), 'utf8');
assert.match(bar, /markNeedsProfilePick\(members\)/, 'tab Switch expands roster');
assert.match(bar, /SwitchPeopleIcon count=\{switchPeopleCount\}/);

const select = readFileSync(join(process.cwd(), 'app/select-profile.tsx'), 'utf8');
assert.match(select, /profilesForSharedDeviceSwitch/);
assert.match(select, /showPersonalSplash/);

console.log('profiles-for-switch: ok');
