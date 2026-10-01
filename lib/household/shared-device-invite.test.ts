/**
 * Shared-device invite + switch-icon geometry.
 * Run: npx tsx lib/household/shared-device-invite.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

// Formations: 2 midline · 3 triangle · 4 square · 5/6 regular polygons.
assert.deepEqual(
  switchArrowAnchors(2).map((a) => a.angle),
  [180, 0]
);
assert.equal(switchArrowAnchors(3)[0].angle, -90, 'triangle starts at top');
assert.equal(switchArrowAnchors(4)[1].angle, 0, 'square has a right-side arrow');
assert.equal(switchArrowAnchors(4)[2].angle, 90, 'and a bottom arrow');

const bar = readFileSync('components/orbit/make-tab-bar.tsx', 'utf8');
assert.match(bar, /SwitchPeopleIcon count=\{switchPeopleCount\}/, 'tab uses N-arrow glyph');
assert.match(
  readFileSync('components/orbit/switch-people-icon.tsx', 'utf8'),
  /doubleArrowPath/,
  'glyph is double-arrows, not a star'
);

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
