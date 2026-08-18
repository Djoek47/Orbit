/**
 * Pending join vs existing household — Check status must not loop home.
 * Run: npx --yes tsx lib/invites/join-approval.test.ts
 */
import assert from 'node:assert/strict';

import { resolveHydrateMembership, resolveJoinApprovalMembership } from './join-approval';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

const ownHome = { household_id: 'hh-own', status: 'active' };
const mugaboPending = { household_id: 'hh-mugabo', status: 'pending' };

{
  const check = resolveJoinApprovalMembership([ownHome, mugaboPending], 'hh-own');
  assert.equal(check.status, 'pending');
  assert.equal(check.membership?.household_id, 'hh-mugabo');
  pass('Check status stays pending even when old home is still active');
}

{
  const check = resolveJoinApprovalMembership([ownHome, mugaboPending], 'hh-mugabo');
  assert.equal(check.status, 'pending');
  assert.equal(check.membership?.household_id, 'hh-mugabo');
  pass('Check status on invited household stays pending');
}

{
  const approved = { household_id: 'hh-mugabo', status: 'active' };
  const check = resolveJoinApprovalMembership([ownHome, approved], 'hh-mugabo');
  assert.equal(check.status, 'approved');
  assert.equal(check.membership?.household_id, 'hh-mugabo');
  pass('Check status returns approved only for the joined household');
}

{
  const missing = resolveJoinApprovalMembership([ownHome], 'hh-mugabo');
  assert.equal(missing.status, 'missing');
  pass('Join request gone → missing, not a silent trip back to the old home');
}

{
  const home = resolveJoinApprovalMembership([ownHome], 'hh-own');
  assert.equal(home.status, 'approved');
  pass('Checking the household you already belong to is approved');
}

{
  const hydrated = resolveHydrateMembership([ownHome, mugaboPending], 'hh-mugabo');
  assert.equal(hydrated?.household_id, 'hh-mugabo');
  pass('Reload prefers the remembered pending join, not the old home');
}

{
  const hydrated = resolveHydrateMembership([ownHome, mugaboPending], null);
  assert.equal(hydrated?.household_id, 'hh-own');
  pass('Without a remembered join, owners keep their home');
}

console.log('\njoin-approval tests passed');
