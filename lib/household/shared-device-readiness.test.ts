import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { listNames, sharedDeviceReadiness } from './shared-device-readiness';
import type { HouseholdMember } from '../../types/orbit';

function member(
  id: string,
  name: string,
  status: HouseholdMember['status'],
  role: HouseholdMember['role'] = 'child'
): HouseholdMember {
  return { id, name, status, role, avatar: '', xp: 0, loadShare: 0 } as unknown as HouseholdMember;
}

const admin = member('n', 'Nero', 'active', 'owner');

// ── Nothing to share with ─────────────────────────────────────────────────────
// An admin on their own is not a household that needs a shared device.
const empty = sharedDeviceReadiness([admin]);
assert.equal(empty.state, 'no-sidekicks');
assert.equal(empty.blocked, true);
assert.equal(empty.action, 'invite');

// ── Invited, never signed in: no longer a wall ───────────────────────────────
// Signing in first is not required any more. Two invited Sidekicks are enough.
const twoInvited = sharedDeviceReadiness([
  admin,
  member('e', 'Emma', 'invited'),
  member('j', 'Jack', 'pending'),
]);
assert.equal(twoInvited.state, 'ready', 'invited Sidekicks can share a device');
assert.equal(twoInvited.blocked, false);
assert.equal(twoInvited.connected.length, 2);

// ── One person: blocked, and it says why ─────────────────────────────────────
const invitedOnly = sharedDeviceReadiness([admin, member('e', 'Emma', 'invited')]);
assert.equal(invitedOnly.state, 'single');
assert.equal(invitedOnly.blocked, true, 'a shared device needs two people');
assert.match(invitedOnly.body, /two or more/);
assert.match(invitedOnly.body, /Emma keeps their own profile/);
assert.equal(invitedOnly.action, 'invite');

const alone = sharedDeviceReadiness([admin, member('j', 'Jack', 'active')]);
assert.equal(alone.state, 'single');
assert.equal(alone.blocked, true);

// One signed in, one invited: that's two — ready.
assert.equal(
  sharedDeviceReadiness([admin, member('j', 'Jack', 'active'), member('e', 'Emma', 'invited')]).state,
  'ready'
);

// ── Two or more — nothing to say ──────────────────────────────────────────────
const ready = sharedDeviceReadiness([
  admin,
  member('j', 'Jack', 'active'),
  member('e', 'Emma', 'active'),
]);
assert.equal(ready.state, 'ready');
assert.equal(ready.blocked, false);
assert.equal(ready.title, '', 'a working case gets no banner');
assert.equal(ready.action, null);
assert.equal(ready.connected.length, 2);

// Admins never count — they stay on their own phones.
assert.equal(
  sharedDeviceReadiness([admin, member('a', 'Ada', 'active', 'admin')]).state,
  'no-sidekicks'
);
// Removed people are not "waiting".
assert.equal(sharedDeviceReadiness([admin, member('x', 'Gone', 'removed')]).state, 'no-sidekicks');

// ── Names ─────────────────────────────────────────────────────────────────────
assert.equal(listNames([]), '');
assert.equal(listNames([member('a', 'Emma Mugabo', 'active')]), 'Emma', 'first names only');
assert.equal(
  listNames([member('a', 'Emma', 'active'), member('b', 'Jack', 'active')]),
  'Emma and Jack'
);
assert.equal(
  listNames([
    member('a', 'Emma', 'active'),
    member('b', 'Jack', 'active'),
    member('c', 'Noah', 'active'),
  ]),
  'Emma, Jack and 1 other'
);

// ── The wizard uses it ────────────────────────────────────────────────────────
const screen = readFileSync('app/setup-kid-device.tsx', 'utf8');
assert.match(screen, /sharedDeviceReadiness/, 'the step asks before it blames');
assert.match(screen, /readiness\.blocked/, 'and Next respects the answer');

// The wizard's grid renders role === 'child' only. Counting an active adult as "connected"
// would show an empty grid with no banner — the exact bug this module exists to prevent.
const adults = sharedDeviceReadiness([admin, member('m', 'Marie', 'active', 'adult')]);
assert.equal(adults.state, 'no-sidekicks', 'an adult with no tile is not a connected Sidekick');
assert.equal(adults.connected.length, 0);

// And the readiness count must match what the grid filters on, exactly.
const wizard = readFileSync('app/setup-kid-device.tsx', 'utf8');
assert.match(wizard, /member\.role === 'child'/, 'the grid still renders children only');

console.log('shared-device-readiness: ok');
