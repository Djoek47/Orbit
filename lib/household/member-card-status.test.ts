/**
 * Run: npx --yes tsx lib/household/member-card-status.test.ts
 */
import assert from 'node:assert/strict';

import { memberCardStatus } from '@/lib/household/member-card-status';
import type { HouseholdMember } from '@/types/orbit';

function member(partial: Partial<HouseholdMember> & Pick<HouseholdMember, 'id' | 'name' | 'role'>): HouseholdMember {
  return {
    avatar: '🧒',
    xp: 0,
    status: 'active',
    loadShare: 1,
    ...partial,
  };
}

{
  const child = member({ id: 'c1', name: 'Maya', role: 'child', status: 'active' });
  const status = memberCardStatus(child, [child]);
  assert.equal(status.line, 'Not set up yet');
  assert.equal(status.actionLabel, 'Set up device');
  assert.equal(status.action, 'setup_device');
}

{
  const device = member({
    id: 'd1',
    name: 'Shared device',
    role: 'shared-device',
    status: 'active',
    sharedWithMemberIds: ['c1'],
  });
  const child = member({ id: 'c1', name: 'Maya', role: 'child', status: 'active', lastSeenAt: new Date().toISOString() });
  const status = memberCardStatus(child, [device, child]);
  assert.match(status.line, /On Shared device/);
  assert.equal(status.actionLabel, null);
}

{
  const adult = member({ id: 'a1', name: 'Sam', role: 'adult', status: 'invited' });
  const status = memberCardStatus(adult, [adult]);
  assert.equal(status.line, 'Waiting for them to join');
  assert.equal(status.action, 'share_invite');
}

{
  const pending = member({ id: 'a2', name: 'Pat', role: 'adult', status: 'pending' });
  const status = memberCardStatus(pending, [pending]);
  assert.equal(status.line, 'Waiting for you to approve');
  assert.equal(status.action, 'approve');
}

console.log('PASS member-card-status');
