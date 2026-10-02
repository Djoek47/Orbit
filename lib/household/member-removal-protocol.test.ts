/**
 * Run: npx tsx lib/household/member-removal-protocol.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isSidekickRemovedSyncError,
  MEMBER_REMOVAL_GRACE_SECONDS,
  MEMBER_REMOVED_KIND,
  memberRemovalNotice,
  removalAudienceIds,
  removalKickCopy,
} from '@/lib/household/member-removal-protocol';

assert.ok(MEMBER_REMOVAL_GRACE_SECONDS >= 8);
assert.deepEqual(
  removalAudienceIds({ targetId: 'm1', targetRole: 'child' }),
  ['m1']
);
assert.deepEqual(
  removalAudienceIds({
    targetId: 'd1',
    targetRole: 'shared-device',
    sharedWithMemberIds: ['m1', 'm2'],
  }),
  ['m1', 'm2']
);

const notice = memberRemovalNotice({
  removedName: 'Jack',
  removedMemberId: 'm1',
  audienceMemberIds: ['m1'],
  householdName: 'Rivera',
});
assert.equal(notice.data.kind, MEMBER_REMOVED_KIND);
assert.match(notice.title, /Removed/);
assert.match(notice.body, /Jack/);

const kick = removalKickCopy('Jack');
assert.match(kick.countdownLabel(5), /5/);
assert.match(kick.body, /invite code/);

assert.equal(isSidekickRemovedSyncError({ error: 'not_found' }), true);
assert.equal(isSidekickRemovedSyncError({ error: 'timeout' }), false);

const store = readFileSync(join(process.cwd(), 'store/orbit-store.tsx'), 'utf8');
assert.match(store, /memberRemovalNotice/, 'admin remove creates the notice');
assert.match(store, /beginMemberRemovalKick/, 'sidekick devices start the countdown');
assert.match(store, /isSharedTabletDeviceSession/, 'shared-device sign-out wipes the tablet');

const screen = readFileSync(
  join(process.cwd(), 'components/orbit/member-removed-countdown.tsx'),
  'utf8'
);
assert.match(screen, /copy\.leaveLabel/);
assert.match(screen, /countdownLabel/);
assert.match(screen, /finishMemberRemovalKick/);
assert.equal(removalKickCopy('Jack').leaveLabel, 'Sign out now');

console.log('member-removal-protocol: ok');
