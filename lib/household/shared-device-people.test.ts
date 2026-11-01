/**
 * Shared device people rules — admins stay off the tablet roster.
 * Run: npx tsx lib/household/shared-device-people.test.ts
 */
import assert from 'node:assert/strict';

import {
  isSharedDeviceEligiblePerson,
  pruneSharedDeviceLinks,
  resolveSharedDevicePeople,
  sharedDeviceLinkCandidates,
  SHARED_DEVICE_MAX_PEOPLE,
} from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

function person(
  id: string,
  name: string,
  role: HouseholdMember['role'],
  extra: Partial<HouseholdMember> = {}
): HouseholdMember {
  return {
    id,
    name,
    role,
    status: 'active',
    xp: 0,
    avatar: '',
    ...extra,
  } as HouseholdMember;
}

const nero = person('n', 'Nero', 'owner');
const emma = person('e', 'Emma', 'child');
const jack = person('j', 'Jack', 'child');
const admin = person('a', 'Ada', 'admin');
const adult = person('u', 'Uncle', 'adult');
const ipad = person('d', 'Ipad', 'shared-device', {
  sharedWithMemberIds: ['e', 'j', 'n', 'a'],
});

assert.equal(SHARED_DEVICE_MAX_PEOPLE, 6);
assert.equal(isSharedDeviceEligiblePerson(nero), false, 'owner stays off the iPad');
assert.equal(isSharedDeviceEligiblePerson(admin), false, 'admin stays off the iPad');
assert.equal(isSharedDeviceEligiblePerson(emma), true);
assert.equal(isSharedDeviceEligiblePerson(adult), true);

const candidates = sharedDeviceLinkCandidates([nero, emma, jack, admin, adult, ipad]);
assert.deepEqual(
  candidates.map((m) => m.id).sort(),
  ['e', 'j', 'u'],
  'only Sidekicks / non-admin adults are candidates'
);

const onDevice = resolveSharedDevicePeople(ipad, [nero, emma, jack, admin, adult, ipad]);
assert.deepEqual(
  onDevice.map((m) => m.name).sort(),
  ['Emma', 'Jack'],
  'linked admins are hidden from the roster'
);

const pruned = pruneSharedDeviceLinks(['e', 'j', 'n', 'a'], [nero, emma, jack, admin, adult, ipad]);
assert.deepEqual(pruned?.sort(), ['e', 'j']);
assert.equal(
  pruneSharedDeviceLinks(['e', 'j'], [nero, emma, jack, admin, adult, ipad]),
  null,
  'clean lists are left alone'
);

console.log('shared-device-people: ok');
