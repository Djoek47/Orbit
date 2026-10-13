import assert from 'node:assert/strict';
import {
  sharedDeviceFullHint,
  sharedDeviceFullMessage,
  sharedDeviceFullTitle,
} from '@/lib/household/shared-device-cap-copy';
import { SHARED_DEVICE_MAX_PEOPLE } from '@/lib/household/shared-device';

assert.equal(SHARED_DEVICE_MAX_PEOPLE, 6);
assert.match(sharedDeviceFullTitle(), /full/i);
assert.match(sharedDeviceFullMessage('Kitchen iPad'), /Kitchen iPad/);
assert.match(sharedDeviceFullMessage('Kitchen iPad'), /6/);
assert.match(sharedDeviceFullMessage(null), /shared device/);
assert.match(sharedDeviceFullHint(), /6/);
assert.doesNotMatch(sharedDeviceFullMessage('Kitchen iPad'), /error|fail|max_/i);

console.log('shared-device-cap-copy.test.ts: ok');
