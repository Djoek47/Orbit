/**
 * Run: npx --yes tsx lib/household/join-policy.test.ts
 */
import assert from 'node:assert/strict';

import {
  canTrustMemberForAutoJoin,
  countMembersForMembersScreen,
  getJoinPolicyMode,
  membersScreenStatusLine,
} from './join-policy';
import type { HouseholdMember } from '@/types/orbit';

const invited: HouseholdMember = {
  id: '1',
  name: 'Emma',
  role: 'child',
  status: 'invited',
  avatar: 'E',
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
assert.equal(canTrustMemberForAutoJoin(invited, { joinApprovalRequired: true }), true);
assert.equal(canTrustMemberForAutoJoin(invited, { joinApprovalRequired: false }), false);

const counts = countMembersForMembersScreen([
  invited,
  { ...invited, id: '3', joinPreApproved: true },
  pending,
]);
assert.equal(counts.awaiting, 2);
assert.equal(counts.pending, 1);
assert.equal(counts.trustedAwaiting, 1);

assert.match(
  membersScreenStatusLine({ pending: 1, awaiting: 0, connected: 1, trustedAwaiting: 0 }, 'review'),
  /waiting for your approval/
);

console.log('join-policy tests passed');
