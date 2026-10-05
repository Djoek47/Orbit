/**
 * Run: npx tsx lib/device/hosted-profiles-sync.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isPersonalSidekickDevice } from '@/lib/device/device-host';
import { mergeHostedProfileMemberIds } from '@/lib/device/device-session';

assert.deepEqual(mergeHostedProfileMemberIds(['a'], ['b']), ['a', 'b']);
assert.deepEqual(mergeHostedProfileMemberIds(['a', 'b'], ['b']), ['a', 'b']);
assert.deepEqual(mergeHostedProfileMemberIds([], ['m1', 'm2']), ['m1', 'm2']);

const selectProfile = readFileSync(join(process.cwd(), 'app/select-profile.tsx'), 'utf8');
assert.match(selectProfile, /reconcileHostedDeviceSession/, 'face picker syncs hosted ids');

const sessionModule = readFileSync(join(process.cwd(), 'lib/device/device-session.ts'), 'utf8');
assert.match(sessionModule, /reconcileHostedDeviceSession/, 'device session reconciles with v2 store');
assert.match(sessionModule, /hostProfileOnDevice[\s\S]*reconcileHostedDeviceSession/, 'join path reconciles');

console.log('hosted-profiles-sync: ok');
