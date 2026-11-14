/**
 * Run: npx tsx lib/household/rotate-profile-invite.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { allocateChildInviteCode } from '@/lib/household/profile-codes';

const a = allocateChildInviteCode('Emma', []);
const b = allocateChildInviteCode('Emma', [a]);
assert.notEqual(a, b);
assert.match(a, /^CMX-[A-Z]{2}[A-Z2-9]{4}$/);
assert.match(b, /^CMX-[A-Z]{2}[A-Z2-9]{4}$/);

const repo = readFileSync('repositories/household-repository.ts', 'utf8');
assert.match(repo, /async rotateMemberProfileInviteCode\(/);
assert.match(
  repo,
  /ensureMemberProfileInviteCode[\s\S]*return this\.rotateMemberProfileInviteCode/
);

const store = readFileSync('store/orbit-store.tsx', 'utf8');
assert.match(store, /rotateMemberProfileInviteCode/);
assert.match(store, /presenceSnapshot/);

console.log('rotate-profile-invite: ok');
