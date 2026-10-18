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

assert.equal(getJoinPolicyMode({ joinApprovalRequired: true }), 'automatic');
assert.equal(getJoinPolicyMode({ joinApprovalRequired: false }), 'automatic');
assert.equal(canTrustMemberForAutoJoin(invitedAdult, { joinApprovalRequired: true }), false);
assert.equal(canTrustMemberForAutoJoin(invitedSidekick, { joinApprovalRequired: true }), false);

const counts = countMembersForMembersScreen([invitedSidekick, invitedAdult]);
assert.equal(counts.awaiting, 2);
assert.equal(counts.pending, 0);
assert.equal(counts.trustedAwaiting, 0);

assert.match(
  membersScreenStatusLine({ pending: 0, awaiting: 1, connected: 1, trustedAwaiting: 0 }, 'automatic'),
  /still needs their invite/
);

assert.equal(canLockInvites([{ id: '1', name: 'Emma', role: 'child', status: 'active', avatar: 'E', xp: 0, loadShare: 0 }]), true);

console.log('join-policy tests passed');
