/**
 * Join approval toggle helpers.
 * Run: npx --yes tsx lib/invites/join-approval-setting.test.ts
 */
import assert from 'node:assert/strict';

function resolveJoinStatus(approvalRequired: boolean): 'pending' | 'active' {
  return approvalRequired ? 'pending' : 'active';
}

assert.equal(resolveJoinStatus(true), 'pending');
assert.equal(resolveJoinStatus(false), 'active');

console.log('join-approval-setting tests passed');
