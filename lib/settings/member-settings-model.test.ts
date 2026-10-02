import assert from 'node:assert/strict';

import { memberSettingsModel, usesMemberSettings } from '@/lib/settings/member-settings-model';
import type { HouseholdMember } from '@/types/orbit';

const person = (id: string, name: string, role: string): HouseholdMember =>
  ({ id, name, role, status: 'active' }) as unknown as HouseholdMember;

const jack = person('m1', 'Jack', 'child');
const ama = person('m2', 'Ama', 'child');
const nero = person('m3', 'Nero', 'child');
const ipad = {
  ...person('d1', 'Kitchen iPad', 'shared-device'),
  sharedWithMemberIds: ['m2', 'm3'],
} as HouseholdMember;
const members = [jack, ama, nero, ipad, person('o1', 'Cisse', 'owner')];

// Which screen.
assert.equal(usesMemberSettings('child'), true);
assert.equal(usesMemberSettings('sidekick'), true);
assert.equal(usesMemberSettings('shared-device'), true, 'the shared device never gets admin settings');
assert.equal(usesMemberSettings('owner'), false);
assert.equal(usesMemberSettings('admin'), false);

// A Sidekick's own phone: no device, no switching, and signing out is their own.
const own = memberSettingsModel({ member: jack, members })!;
assert.equal(own.kind, 'sidekick');
assert.equal(own.canSwitchProfiles, false);
assert.equal(own.deviceName, undefined);
assert.equal(own.signOut.label, 'Sign out');

// Someone on the shared device: switching is the way out, and sign out warns it takes the others.
const shared = memberSettingsModel({ member: ama, members })!;
assert.equal(shared.kind, 'shared-account');
assert.equal(shared.deviceName, 'Kitchen device');
assert.equal(shared.canSwitchProfiles, true);
assert.deepEqual(shared.sharedWith, ['Nero'], 'the others, not themselves');
assert.match(shared.signOut.body, /Nero/);
assert.match(shared.signOut.body, /Switch who/);
assert.equal(shared.signOut.label, 'Sign this device out');

// The shared device before anyone picks a face.
const device = memberSettingsModel({ member: ipad, members })!;
assert.equal(device.kind, 'shared-device');
assert.deepEqual(device.sharedWith, ['Ama', 'Nero']);
assert.match(device.signOut.body, /Ama and Nero/);
assert.match(device.signOut.title, /Kitchen device/);

// Three or more names read as a sentence.
const big = { ...ipad, sharedWithMemberIds: ['m1', 'm2', 'm3'] } as HouseholdMember;
const bigModel = memberSettingsModel({ member: big, members: [jack, ama, nero, big] })!;
assert.match(bigModel.signOut.body, /Jack, Ama and Nero/);

// A device nobody is on yet still reads as a sentence.
const lonely = { ...ipad, sharedWithMemberIds: [] } as HouseholdMember;
const lonelyModel = memberSettingsModel({ member: lonely, members: [lonely] })!;
assert.match(lonelyModel.signOut.body, /everyone on it/);

assert.equal(memberSettingsModel({ member: null, members }), null);

console.log('member-settings-model: ok');
