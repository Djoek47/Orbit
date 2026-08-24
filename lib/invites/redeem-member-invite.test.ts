/**
 * Revision G §2 / §3 / §6 invite redemption.
 * Run: npx --yes tsx lib/invites/redeem-member-invite.test.ts
 */
import assert from 'node:assert/strict';

import { roleWrittenOnInvite } from '@/lib/household/admin-cap';
import { parseMemberInviteTokenFromUrl } from '@/lib/invite/deep-links';
import {
  redeemMemberInvite,
  type StoredInviteToken,
} from '@/lib/invites/redeem-member-invite';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function token(over: Partial<StoredInviteToken> = {}): StoredInviteToken {
  return {
    token: 'tok',
    householdId: 'hh-1',
    householdName: 'The Riveras',
    memberId: 'maya',
    memberName: 'Maya',
    role: 'sidekick',
    status: 'active',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    adminName: 'Pat',
    ...over,
  };
}

{
  const result = redeemMemberInvite({
    token: token({ role: 'sidekick' }),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: null,
    authUserMemberId: null,
    clientRole: 'admin',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.role, 'sidekick');
    assert.equal(result.memberStatus, 'active');
  }
  pass('A2.1 client {role:admin} is ignored; token sidekick wins');
}

{
  assert.equal(roleWrittenOnInvite(false, 'admin'), 'sidekick');
  assert.equal(roleWrittenOnInvite(true, 'admin'), 'admin');
  pass('A2.3 non-owner invite generation is forced sidekick');
}

{
  const result = redeemMemberInvite({
    token: token({ role: 'admin' }),
    memberExists: true,
    adminSeatCount: 2,
    authUserHouseholdId: null,
    authUserMemberId: null,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'admin_cap');
    assert.equal(result.consumeToken, false);
  }
  pass('A2.6 / §6 admin invite when slots full is rejected and not consumed');
}

{
  const expired = redeemMemberInvite({
    token: token({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: null,
    authUserMemberId: null,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) {
    assert.equal(expired.message, 'This invite has expired. Ask Pat for a new one.');
    assert.equal(expired.consumeToken, false);
  }
  pass('§6 expired copy names the admin');
}

{
  const used = redeemMemberInvite({
    token: token({ status: 'redeemed' }),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: null,
    authUserMemberId: null,
  });
  assert.equal(used.ok, false);
  if (!used.ok) {
    assert.equal(used.message, 'This invite has already been used.');
  }
  pass('A3.3 / §6 already used');
}

{
  const revoked = redeemMemberInvite({
    token: token({ status: 'revoked' }),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: null,
    authUserMemberId: null,
  });
  assert.equal(revoked.ok, false);
  if (!revoked.ok) {
    assert.equal(revoked.message, 'This invite has expired. Ask Pat for a new one.');
  }
  pass('§6 revoked uses expired copy');
}

{
  const gone = redeemMemberInvite({
    token: token(),
    memberExists: false,
    adminSeatCount: 1,
    authUserHouseholdId: null,
    authUserMemberId: null,
  });
  assert.equal(gone.ok, false);
  if (!gone.ok) assert.equal(gone.code, 'member_gone');
  pass('§6 member row deleted');
}

{
  const other = redeemMemberInvite({
    token: token(),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: 'other-hh',
    authUserMemberId: 'someone',
  });
  assert.equal(other.ok, false);
  if (!other.ok) {
    assert.equal(other.message, 'This account already belongs to another household.');
  }
  pass('§6 already in another household');
}

{
  const same = redeemMemberInvite({
    token: token(),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: 'hh-1',
    authUserMemberId: 'maya',
  });
  assert.equal(same.ok, true);
  if (same.ok) assert.equal(same.alreadyMember, true);
  pass('§6 already this member signs in');
}

{
  const adult = redeemMemberInvite({
    token: token({ role: 'admin' }),
    memberExists: true,
    adminSeatCount: 1,
    authUserHouseholdId: null,
    authUserMemberId: null,
  });
  assert.equal(adult.ok, true);
  if (adult.ok) {
    assert.equal(adult.memberStatus, 'pending');
    assert.equal(adult.role, 'admin');
  }
  pass('A5.1 admin token stays pending');
}

{
  assert.equal(
    parseMemberInviteTokenFromUrl('choremaxx://invite/member?token=abc123'),
    'abc123'
  );
  pass('deep link choremaxx://invite/member?token=');
}

console.log('\nredeem-member-invite tests passed');
