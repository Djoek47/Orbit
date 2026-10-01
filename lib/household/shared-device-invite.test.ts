/**
 * Shared-device invite + switch-icon geometry.
 * Run: npx tsx lib/household/shared-device-invite.test.ts
 */
import assert from 'node:assert/strict';

import {
  buildSharedDeviceInviteLink,
  parseSharedDeviceInvitePayload,
} from '@/lib/household/shared-device-invite';
import {
  clampSwitchPeopleCount,
  switchArrowAnchors,
} from '@/lib/household/switch-people-geometry';

assert.equal(clampSwitchPeopleCount(1), 2);
assert.equal(clampSwitchPeopleCount(2), 2);
assert.equal(clampSwitchPeopleCount(6), 6);
assert.equal(clampSwitchPeopleCount(9), 6);

assert.equal(switchArrowAnchors(2).length, 2);
assert.equal(switchArrowAnchors(3).length, 3);
assert.equal(switchArrowAnchors(4).length, 4);
assert.equal(switchArrowAnchors(5).length, 5);
assert.equal(switchArrowAnchors(6).length, 6);

const link = buildSharedDeviceInviteLink({
  label: 'Kitchen iPad',
  codes: ['cmx-maya', 'CMX-JACK'],
});
assert.match(link, /^choremaxx:\/\/shared-device\?/);
assert.match(link, /Kitchen/);
const parsed = parseSharedDeviceInvitePayload(link);
assert.ok(parsed);
assert.equal(parsed!.label, 'Kitchen iPad');
assert.deepEqual(parsed!.codes, ['CMX-MAYA', 'CMX-JACK']);

assert.equal(parseSharedDeviceInvitePayload('choremaxx://join/CMX-MAYA'), null);
assert.equal(parseSharedDeviceInvitePayload(''), null);

console.log('shared-device-invite: ok');
