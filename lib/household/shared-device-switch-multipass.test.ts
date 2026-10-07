/**
 * Multipass: Home Switch · Name + tab Switch arrows + select-profile roster.
 * Run: npx tsx lib/household/shared-device-switch-multipass.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isPersonalSidekickDevice } from '@/lib/device/device-host';
import { isSharedTabletDeviceSession } from '@/lib/device/device-session';
import { profilesForSharedDeviceSwitch } from '@/lib/device/profiles-for-switch';
import { clampSwitchPeopleCount } from '@/lib/household/switch-people-geometry';
import type { DeviceSession } from '@/lib/device/device-session';
import type { HouseholdMember } from '@/types/orbit';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const emma = {
  id: 'e',
  name: 'Emma',
  role: 'child',
  status: 'active',
  xp: 0,
  avatar: '👩',
} as HouseholdMember;
const jack = {
  id: 'j',
  name: 'Jack',
  role: 'child',
  status: 'active',
  xp: 0,
  avatar: '⚡',
} as HouseholdMember;
const test = {
  id: 'd',
  name: 'Test',
  role: 'shared-device',
  status: 'active',
  xp: 0,
  avatar: '',
  sharedWithMemberIds: ['e', 'j'],
} as HouseholdMember;
const members = [emma, jack, test];

// Pass 1 — roster always yields both faces even if only Jack is hosted locally.
{
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'shared-tablet',
    profileMemberIds: ['j'],
    activeMemberId: 'j',
    needsProfilePick: false,
    sharedDeviceId: 'd',
    deviceLabel: 'Test',
  };
  const faces = profilesForSharedDeviceSwitch(session, members);
  assert.deepEqual(faces.map((m) => m.name).sort(), ['Emma', 'Jack']);
  assert.equal(isPersonalSidekickDevice(session, faces), false);
  assert.equal(isSharedTabletDeviceSession({ ...session, profileMemberIds: ['e', 'j'] }), true);
  assert.equal(clampSwitchPeopleCount(faces.length), 2);
}

// Pass 2 — Home menu + tab Switch wiring.
assert.match(read('app/(tabs)/index.tsx'), /SharedDeviceSwitchMenu/);
assert.match(read('components/orbit/shared-device-switch-menu.tsx'), /no sign-out/i);
assert.match(read('components/orbit/make-tab-bar.tsx'), /markNeedsProfilePick\(members\)/);
assert.match(read('components/orbit/switch-people-icon.tsx'), /Switch between \$\{n\} people/);

// Pass 2b — Connected chip is device-level (same for Jack and Emma), not lastSeen.
{
  const menu = read('components/orbit/shared-device-switch-menu.tsx');
  assert.match(menu, /isSharedTabletDeviceSession\(session\)/);
  assert.match(menu, /connected \? 'Connected' : 'Not connected'/);
  assert.doesNotMatch(
    menu,
    /memberPresenceParts\(currentMember\)/,
    'status chip must not use per-face Sidekick presence'
  );
  assert.doesNotMatch(
    menu,
    /connected \? 'Connected' : deviceName/,
    'must not fall back to Emma\'s device / shell name on the status chip'
  );
}

// Pass 3 — select-profile never auto-splash when roster has 2+.
const select = read('app/select-profile.tsx');
assert.match(select, /showPersonalSplash/);
assert.doesNotMatch(select, /sidekickUnlock && profiles\.length === 1/);

// Pass 4 — switchPersona contract in store (no clearSidekickSession).
const store = read('store/orbit-store.tsx');
const switchBlock = store.slice(
  store.indexOf('const switchPersona = '),
  store.indexOf('const approveMember = ')
);
assert.ok(switchBlock.includes('selectDeviceProfile'));
assert.ok(!/\bclearSidekickSession\s*\(/.test(switchBlock));

console.log('shared-device-switch-multipass: ok');
