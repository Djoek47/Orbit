/**
 * Run: npx --yes tsx lib/household/join-policy.test.ts
 */
import assert from 'node:assert/strict';

import {
  canLockInvites,
  canTrustMemberForAutoJoin,
  countMembersForMembersScreen,
  getJoinPolicyMode,
  membersScreenStatusLine,
} from './join-policy';
import type { HouseholdMember } from '@/types/orbit';

const invitedSidekick: HouseholdMember = {
  id: '1',
  name: 'Emma',
  role: 'child',
  status: 'invited',
  avatar: 'E',
  xp: 0,
  loadShare: 0,
};

const invitedAdult: HouseholdMember = {
  id: '4',
  name: 'Alex',
  role: 'adult',
  status: 'invited',
  avatar: 'A',
  xp: 0,
  loadShare: 0,
};

const pending: HouseholdMember = {
  id: '2',
  name: 'Sam',
  role: 'adult',
  status: 'pending',
  avatar: 'S',
  xp: 0,
  loadShare: 0,
};

assert.equal(getJoinPolicyMode({ joinApprovalRequired: true }), 'review');
assert.equal(getJoinPolicyMode({ joinApprovalRequired: false }), 'automatic');
assert.equal(canTrustMemberForAutoJoin(invitedAdult, { joinApprovalRequired: true }), true);
assert.equal(canTrustMemberForAutoJoin(invitedSidekick, { joinApprovalRequired: true }), false);
assert.equal(canTrustMemberForAutoJoin(invitedAdult, { joinApprovalRequired: false }), false);

const counts = countMembersForMembersScreen([
  invitedSidekick,
  { ...invitedSidekick, id: '3', joinPreApproved: true },
  pending,
]);
assert.equal(counts.awaiting, 2);
assert.equal(counts.pending, 1);
assert.equal(counts.trustedAwaiting, 1);

assert.match(
  membersScreenStatusLine({ pending: 1, awaiting: 0, connected: 1, trustedAwaiting: 0 }, 'review'),
  /waiting for your approval/
);

assert.equal(canLockInvites([{ id: '1', name: 'Emma', role: 'child', status: 'active', avatar: 'E', xp: 0, loadShare: 0 }]), true);

console.log('join-policy tests passed');
