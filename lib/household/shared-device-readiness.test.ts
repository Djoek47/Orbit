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

// ── Invited, never signed in — the case that looked broken ────────────────────
// Emma is invited; the grid would be empty under "Tap each Sidekick who shares it".
const invitedOnly = sharedDeviceReadiness([admin, member('e', 'Emma', 'invited')]);
assert.equal(invitedOnly.state, 'none-connected');
assert.equal(invitedOnly.blocked, true, 'Next must not advance into a dead end');
assert.equal(invitedOnly.action, 'wait');
assert.match(invitedOnly.body, /Emma/, 'it names who we are waiting on');
assert.match(invitedOnly.body, /hasn't signed in/, 'singular reads correctly');

const twoInvited = sharedDeviceReadiness([
  admin,
  member('e', 'Emma', 'invited'),
  member('j', 'Jack', 'pending'),
]);
assert.equal(twoInvited.state, 'none-connected');
assert.match(twoInvited.body, /Emma and Jack/);
assert.match(twoInvited.body, /haven't signed in/, 'plural reads correctly');

// ── One connected — allowed, but say it plainly ───────────────────────────────
// This is the screenshot: Jack signed in, Emma still invited.
const jackOnly = sharedDeviceReadiness([
  admin,
  member('j', 'Jack', 'active'),
  member('e', 'Emma', 'invited'),
]);
assert.equal(jackOnly.state, 'single');
assert.equal(jackOnly.blocked, false, 'one person may still set it up');
assert.match(jackOnly.title, /Jack/);
assert.match(jackOnly.body, /two or more/, 'it says what the feature is actually for');
assert.match(jackOnly.body, /Emma/, 'and who would make it worthwhile');
assert.equal(jackOnly.connected.length, 1);
assert.equal(jackOnly.waiting.length, 1);

// One connected and nobody else invited — different advice, still allowed.
const alone = sharedDeviceReadiness([admin, member('j', 'Jack', 'active')]);
assert.equal(alone.state, 'single');
assert.equal(alone.blocked, false);
assert.match(alone.body, /their own phone works better/);
assert.equal(alone.action, 'invite');

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
