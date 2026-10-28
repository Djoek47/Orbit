/**
 * Run: npx --yes tsx lib/notifications/open-as-member.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  shouldOpenNotificationAsMember,
  targetMemberIdFromPushData,
} from '@/lib/notifications/open-as-member';
import type { DeviceSession } from '@/lib/device/device-session';

assert.equal(targetMemberIdFromPushData({ targetMemberId: 'e1' }), 'e1');
assert.equal(targetMemberIdFromPushData({ memberId: 'j1' }), 'j1');
assert.equal(targetMemberIdFromPushData({}), null);

const shared: DeviceSession = {
  mode: 'shared',
  hostKind: 'shared-tablet',
  profileMemberIds: ['e1', 'j1'],
  activeMemberId: 'e1',
  needsProfilePick: false,
};

assert.equal(
  shouldOpenNotificationAsMember({
    targetMemberId: 'j1',
    currentMemberId: 'e1',
    session: shared,
  }),
  true
);
assert.equal(
  shouldOpenNotificationAsMember({
    targetMemberId: 'e1',
    currentMemberId: 'e1',
    session: shared,
  }),
  false
);
assert.equal(
  shouldOpenNotificationAsMember({
    targetMemberId: 'j1',
    currentMemberId: 'e1',
    session: { ...shared, mode: 'personal', profileMemberIds: [] },
  }),
  false
);

const bridge = readFileSync(join(process.cwd(), 'components/orbit/notification-tap-bridge.tsx'), 'utf8');
assert.match(bridge, /shouldOpenNotificationAsMember/);
assert.match(bridge, /selectDeviceProfile/);
assert.match(bridge, /switchPersona/);

const navigate = readFileSync(join(process.cwd(), 'lib/notifications/navigate.ts'), 'utf8');
assert.match(navigate, /smart_digest/);
assert.match(navigate, /tab=activity/);

console.log('open-as-member: ok');
