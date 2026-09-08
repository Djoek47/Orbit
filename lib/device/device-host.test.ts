import assert from 'node:assert/strict';

import { isPersonalSidekickDevice } from '@/lib/device/device-host';
import type { DeviceSession } from '@/lib/device/device-session';
import type { HouseholdMember } from '@/types/orbit';

const child: HouseholdMember = {
  id: 'm1',
  name: 'Cisse',
  role: 'child',
  status: 'active',
  avatar: '🎯',
  xp: 10,
  loadShare: 0,
};

{
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'sidekick',
    profileMemberIds: ['m1'],
    activeMemberId: null,
    needsProfilePick: true,
    deviceLabel: "Cisse's device",
  };
  assert.equal(isPersonalSidekickDevice(session, [child]), true);
}

{
  const session: DeviceSession = {
    mode: 'shared',
    hostKind: 'shared-tablet',
    profileMemberIds: ['m1', 'm2'],
    activeMemberId: null,
    needsProfilePick: true,
    deviceLabel: 'Family iPad',
  };
  assert.equal(isPersonalSidekickDevice(session, [child]), false);
}

{
  const session: DeviceSession = {
    mode: 'shared',
    profileMemberIds: ['m1'],
    activeMemberId: null,
    needsProfilePick: true,
    deviceLabel: "Cisse's device",
  };
  assert.equal(isPersonalSidekickDevice(session, [child]), true);
}

console.log('PASS device-host');
