/**
 * A7 — Account matrix (families-only).
 * Parent/admin, helper/child, shared tablet expectations.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatHouseholdRole, getPermissionsForRole } from '@/lib/permissions';

test('A7 owner/admin can manage household + approve rewards', () => {
  for (const role of ['owner', 'admin'] as const) {
    const p = getPermissionsForRole(role);
    assert.equal(p.canManageHousehold, true, role);
    assert.equal(p.canApproveReward, true, role);
    assert.equal(p.canInviteMembers, true, role);
  }
});

test('A7 child cannot manage household or approve rewards', () => {
  const p = getPermissionsForRole('child');
  assert.equal(p.canManageHousehold, false);
  assert.equal(p.canApproveReward, false);
  assert.equal(p.canInviteMembers, false);
  assert.equal(formatHouseholdRole('child'), 'Helper');
});

test('A7 shared tablet is limited (no admin powers)', () => {
  const p = getPermissionsForRole('shared-device');
  assert.equal(p.canManageHousehold, false);
  assert.equal(p.canApproveReward, false);
  assert.equal(p.canInviteMembers, false);
});

test('A7 adult can approve but not invite', () => {
  const p = getPermissionsForRole('adult');
  assert.equal(p.canManageHousehold, false);
  assert.equal(p.canApproveReward, true);
  assert.equal(p.canInviteMembers, false);
});
