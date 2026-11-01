/**
 * Run: npx tsx lib/device/profile-picker-layout.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  normalizeSharedDeviceLabel,
  profilePickerLayout,
  profilePickerRows,
} from '@/lib/device/profile-picker-layout';

assert.equal(profilePickerLayout(2).columns, 2);
assert.equal(profilePickerLayout(2).ring, 112);
assert.equal(profilePickerLayout(6).columns, 3);
assert.equal(profilePickerRows(['a', 'b', 'c', 'd', 'e'], 3).length, 2);
assert.equal(profilePickerRows(['a', 'b'], 2)[0]?.length, 2);

assert.equal(normalizeSharedDeviceLabel('Family tablet'), 'Family device');
assert.equal(normalizeSharedDeviceLabel('Kitchen iPad'), 'Kitchen device');
assert.equal(normalizeSharedDeviceLabel(undefined), 'Shared device');

const screen = readFileSync(join(process.cwd(), 'app/select-profile.tsx'), 'utf8');
assert.match(screen, /Who.*using this device/, 'headline says device, not iPad');
assert.doesNotMatch(screen, /Who.*iPad/, 'no iPad in the headline');
assert.match(
  readFileSync(join(process.cwd(), 'components/orbit/shared-device-profile-picker.tsx'), 'utf8'),
  /profilePickerRows/,
  'partial rows stay centered'
);

console.log('profile-picker-layout: ok');
