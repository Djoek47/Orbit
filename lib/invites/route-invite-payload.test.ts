/**
 * Run: npx --yes tsx --test lib/invites/route-invite-payload.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSharedDeviceInviteLink } from '@/lib/household/shared-device-invite';
import {
  memberIsOnSharedShell,
  routeInvitePayload,
} from '@/lib/invites/route-invite-payload';

const session = { isSignedIn: false, isPendingMember: false, hasHousehold: false };

test('shared-device multi-code URL routes to join-shared-device before profile parse', () => {
  const link = buildSharedDeviceInviteLink({
    label: 'Test',
    codes: ['CMX-JA9G9N', 'CMX-EM7K4Q'],
  });
  const routed = routeInvitePayload(link, session);
  assert.ok(routed);
  assert.equal(routed!.kind, 'shared-device');
  assert.match(routed!.href, /\/join-shared-device\?payload=/);
});

test('personal CMX profile code routes to join-profile', () => {
  const routed = routeInvitePayload('CMX-JA9G9N', session);
  assert.ok(routed);
  assert.equal(routed!.kind, 'profile');
  assert.match(routed!.href, /\/join-profile\?code=/);
});

test('memberIsOnSharedShell detects faces listed on a tablet shell', () => {
  assert.equal(
    memberIsOnSharedShell('emma', [
      { id: 'shell', role: 'shared-device', sharedWithMemberIds: ['jack', 'emma'] },
    ]),
    true
  );
  assert.equal(
    memberIsOnSharedShell('alex', [
      { id: 'shell', role: 'shared-device', sharedWithMemberIds: ['jack', 'emma'] },
    ]),
    false
  );
});
