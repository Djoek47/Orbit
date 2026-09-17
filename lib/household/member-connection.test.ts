import assert from 'node:assert/strict';

import {
  blocksPreviousDisplayName,
  isMemberFullyConnected,
  memberConnectionPhase,
} from '@/lib/household/member-connection';
import type { HouseholdMember } from '@/types/orbit';

const ghost: HouseholdMember = {
  id: 'm1',
  name: 'Jenny',
  role: 'child',
  status: 'invited',
  avatar: 'J',
  xp: 40,
  loadShare: 0,
};

const connected: HouseholdMember = {
  ...ghost,
  status: 'active',
  userId: 'user-1',
};

assert.equal(memberConnectionPhase(ghost), 'awaiting');
assert.equal(isMemberFullyConnected(ghost), false);
assert.equal(memberConnectionPhase(connected), 'connected');
assert.equal(isMemberFullyConnected(connected), true);

const activeSidekick: HouseholdMember = {
  ...ghost,
  status: 'active',
};

assert.equal(memberConnectionPhase(activeSidekick), 'connected');
assert.equal(isMemberFullyConnected(activeSidekick), true);

const activeCoAdmin: HouseholdMember = {
  id: 'm2',
  name: 'Alex',
  role: 'admin',
  status: 'active',
  avatar: 'A',
  xp: 0,
  loadShare: 0,
};

assert.equal(memberConnectionPhase(activeCoAdmin), 'connected');
assert.equal(isMemberFullyConnected(activeCoAdmin), true);

const invitedCoAdmin: HouseholdMember = {
  ...activeCoAdmin,
  status: 'invited',
};

assert.equal(memberConnectionPhase(invitedCoAdmin), 'awaiting');
assert.equal(isMemberFullyConnected(invitedCoAdmin), false);

assert.equal(blocksPreviousDisplayName('Maya', 'Maya'), true);
assert.equal(blocksPreviousDisplayName('Maya', 'Maya R.'), false);

console.log('member-connection.test.ts ok');
