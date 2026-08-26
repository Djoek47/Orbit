/**
 * Sidekick invite codes must retry globally unique collisions (CMX-LIAM → CMX-LIAM2).
 * Run: npx tsx lib/household/profile-codes.test.ts
 */

import assert from 'node:assert/strict';

import { isUniqueViolation } from '@/lib/db/unique-violation';
import {
  allocateChildInviteCode,
  childInviteCodeFromName,
} from '@/lib/household/profile-codes';

assert.equal(childInviteCodeFromName('Liam'), 'CMX-LIAM');
assert.equal(allocateChildInviteCode('Liam'), 'CMX-LIAM');
assert.equal(allocateChildInviteCode('Liam', ['CMX-LIAM']), 'CMX-LIAM2');
assert.equal(allocateChildInviteCode('Liam', ['CMX-LIAM', 'CMX-LIAM2']), 'CMX-LIAM3');
assert.equal(allocateChildInviteCode('Zack', ['CMX-ZACK']), 'CMX-ZACK2');

assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key' }), true);
assert.equal(isUniqueViolation({ message: 'duplicate key value violates unique constraint' }), true);
assert.equal(isUniqueViolation({ code: '23503', message: 'foreign key' }), false);

console.log('PASS profile-codes');
