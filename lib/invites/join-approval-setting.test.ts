/**
 * Join approval toggle helpers.
 * Run: npx --yes tsx lib/invites/join-approval-setting.test.ts
 */
import assert from 'node:assert/strict';

import { joinNeedsApproval, resolveJoinStatus } from './join-approval';

assert.equal(resolveJoinStatus(true, false), 'pending');
assert.equal(resolveJoinStatus(true, true), 'active');
assert.equal(resolveJoinStatus(false, false), 'active');
assert.equal(resolveJoinStatus(false, true), 'active');
assert.equal(resolveJoinStatus(undefined, false), 'pending');
assert.equal(resolveJoinStatus(null, true), 'active');

assert.equal(joinNeedsApproval(true, false), true);
assert.equal(joinNeedsApproval(true, true), false);
assert.equal(joinNeedsApproval(false, false), false);
assert.equal(joinNeedsApproval(true, false, 'child'), false);
assert.equal(joinNeedsApproval(true, false, 'adult'), true);
assert.equal(resolveJoinStatus(true, false, 'child'), 'active');

console.log('join-approval-setting tests passed');
