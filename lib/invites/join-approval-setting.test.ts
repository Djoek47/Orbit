/**
 * Join approval removed — all invites connect immediately.
 * Run: npx --yes tsx lib/invites/join-approval-setting.test.ts
 */
import assert from 'node:assert/strict';

import { joinNeedsApproval, resolveJoinStatus } from './join-approval';

assert.equal(resolveJoinStatus(true, false), 'active');
assert.equal(resolveJoinStatus(true, true), 'active');
assert.equal(resolveJoinStatus(false, false), 'active');
assert.equal(resolveJoinStatus(undefined, false), 'active');
assert.equal(resolveJoinStatus(true, false, 'child'), 'active');
assert.equal(resolveJoinStatus(true, false, 'adult'), 'active');

assert.equal(joinNeedsApproval(true, false), false);
assert.equal(joinNeedsApproval(true, true), false);
assert.equal(joinNeedsApproval(false, false), false);
assert.equal(joinNeedsApproval(true, false, 'child'), false);
assert.equal(joinNeedsApproval(true, false, 'adult'), false);

console.log('join-approval-setting tests passed');
