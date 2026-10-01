import assert from 'node:assert/strict';

import {
  sidekickSetupRoute,
  sidekickSetupTarget,
} from '@/lib/household/sidekick-setup-target';
import type { HouseholdMember } from '@/types/orbit';

const sk = (id: string, name: string, status: string, lastSeenAt?: string): HouseholdMember =>
  ({ id, name, role: 'child', status, lastSeenAt }) as unknown as HouseholdMember;

const owner = { id: 'o', name: 'Cisse', role: 'owner', status: 'active' } as HouseholdMember;
const ipad = { id: 'd', name: 'iPad', role: 'shared-device', status: 'active' } as HouseholdMember;

// Nobody to set up yet → the row offers to add one.
const none = sidekickSetupTarget([owner, ipad]);
assert.equal(none.kind, 'none');
assert.equal(sidekickSetupRoute(none), '/settings?section=members&add=1');

// Exactly one waiting → straight to their QR, no hunting.
const one = sidekickSetupTarget([owner, sk('m1', 'Jack', 'invited')]);
assert.equal(one.kind, 'member');
assert.equal(one.kind === 'member' && one.member.name, 'Jack');
assert.equal(sidekickSetupRoute(one), '/settings?section=members&invite=m1');

// Several waiting → pick from the roster.
const many = sidekickSetupTarget([owner, sk('m1', 'Jack', 'invited'), sk('m2', 'Ama', 'pending')]);
assert.equal(many.kind, 'pick');
assert.equal(many.kind === 'pick' && many.waiting.length, 2);
assert.equal(sidekickSetupRoute(many), '/settings?section=members&invite=pick');

// Already connected ones don't count as waiting.
const mixed = sidekickSetupTarget([
  owner,
  sk('m1', 'Jack', 'active'),
  sk('m2', 'Ama', 'invited'),
]);
assert.equal(mixed.kind, 'member');
assert.equal(mixed.kind === 'member' && mixed.member.name, 'Ama');

// A Sidekick seen on a device counts even while the roster still says invited.
const seen = sidekickSetupTarget([owner, sk('m1', 'Jack', 'invited', '2026-09-30T10:00:00Z')]);
assert.equal(seen.kind, 'pick', 'nothing waiting — but a code can still be re-shown');

console.log('sidekick-setup-target: ok');
