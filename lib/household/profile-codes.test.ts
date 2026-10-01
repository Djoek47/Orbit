/**
 * Sidekick invite codes — strong tokens, not guessable CMX-EMMA / CMX-EMMA8.
 * Run: npx tsx lib/household/profile-codes.test.ts
 */

import assert from 'node:assert/strict';

import { isUniqueViolation } from '@/lib/db/unique-violation';
import {
  allocateChildInviteCode,
  childInviteCodeFromName,
  childInviteHint,
  isLegacyNameProfileCode,
} from '@/lib/household/profile-codes';
import { classifyInviteCode } from '@/lib/invites/invite-intent';
import { allocateHouseholdInviteCode, createInviteCode } from '@/lib/invites/parse-invite';

assert.equal(childInviteHint('Emma'), 'EM');
assert.equal(childInviteHint('Liam'), 'LI');
assert.equal(childInviteHint('A'), 'AX');
assert.equal(childInviteHint(''), 'XX');

// Legacy helper still produces the old shape (for docs / migration awareness).
assert.equal(childInviteCodeFromName('Liam'), 'CMX-LIAM');
assert.equal(isLegacyNameProfileCode('CMX-EMMA'), true);
assert.equal(isLegacyNameProfileCode('CMX-EMMA8'), true);
assert.equal(isLegacyNameProfileCode('CMX-EM7K4Q'), false);

const a = allocateChildInviteCode('Emma');
const b = allocateChildInviteCode('Emma', [a]);
assert.match(a, /^CMX-EM[A-Z2-9]{4}$/);
assert.match(b, /^CMX-EM[A-Z2-9]{4}$/);
assert.notEqual(a, b);
assert.equal(classifyInviteCode(a), 'profile');
assert.equal(classifyInviteCode(b), 'profile');
assert.equal(isLegacyNameProfileCode(a), false);

// Collision set of many codes still yields a fresh unused one.
const taken = new Set<string>();
for (let i = 0; i < 40; i += 1) {
  const next = allocateChildInviteCode('Emma', taken);
  assert.equal(taken.has(next), false);
  taken.add(next);
  assert.equal(classifyInviteCode(next), 'profile');
}

assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key' }), true);
assert.equal(isUniqueViolation({ message: 'duplicate key value violates unique constraint' }), true);
assert.equal(isUniqueViolation({ details: 'Key already exists' }), true);
assert.equal(isUniqueViolation({ code: '23503', message: 'foreign key' }), false);

const house = createInviteCode();
assert.match(house, /^CMX-\d{6}$/);
assert.equal(classifyInviteCode(house), 'household');
const takenHouse = allocateHouseholdInviteCode([house]);
assert.notEqual(takenHouse, house);
assert.equal(classifyInviteCode(takenHouse), 'household');

console.log('PASS profile-codes');
