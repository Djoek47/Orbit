/**
 * Rev F §4 / §3 / §5 unit tests.
 */
import assert from 'node:assert/strict';

import {
  blockedRequestCopy,
  canRequestReward,
  canRequestRewardAgain,
} from '@/lib/rewards/can-request-reward';
import {
  activeInviteForMember,
  alreadyOnDeviceMessage,
  createMemberInvite,
  generateInviteToken,
  markInviteUsed,
  revokePreviousInvites,
  validateMemberInvite,
} from '@/lib/household/member-invites';
import {
  isActiveTask,
  isExpiredVisibleInTab,
  groupExpiredByDay,
} from '@/lib/tasks/expired-tab';
import type { HouseholdTask } from '@/types/orbit';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

function task(partial: Partial<HouseholdTask>): HouseholdTask {
  return {
    id: 't',
    title: 'Load the dishwasher',
    category: 'kitchen_dining',
    assignee: 'Maya',
    due: 'Today',
    xp: 10,
    repeat: 'Daily',
    status: 'Pending',
    ...partial,
  };
}

{
  const gate = canRequestReward('Maya', [
    task({ id: '1', status: 'Pending' }),
    task({ id: '2', title: 'Math worksheet', category: 'homework_education', status: 'Pending' }),
  ]);
  assert.equal(gate.allowed, false);
  assert.equal(gate.remaining.tasks, 1);
  assert.equal(gate.remaining.homework, 1);
  const copy = blockedRequestCopy(gate);
  assert.equal(copy.title, 'Not just yet');
  assert.deepEqual(copy.lines, ['1 task left', '1 homework left']);
  pass('F4.2', 'Outstanding work blocks with live counts');
}

{
  const gate = canRequestReward('Maya', [
    task({ id: '1', status: 'Completed', completedLate: true }),
    task({
      id: '2',
      title: 'Math',
      category: 'homework_education',
      status: 'Completed',
      completedLate: true,
    }),
  ]);
  assert.equal(gate.allowed, true);
  pass('F4.5', 'Late completions count toward the gate');
}

{
  const gate = canRequestReward('Maya', [
    task({ id: '1', status: 'Expired', occurrenceDate: new Date().toISOString().slice(0, 10) }),
  ]);
  assert.equal(gate.allowed, false);
  assert.equal(gate.remaining.tasks, 1);
  pass('F4.6', 'Expired task blocks requests for the day');
}

{
  assert.equal(canRequestReward('Maya', []).allowed, false);
  pass('G7.3c', 'Zero assigned items → gate closed');
}

{
  assert.equal(
    canRequestRewardAgain({
      frequency: 'Daily',
      lastRequestedAt: new Date().toISOString(),
    }),
    false
  );
  pass('F4.8', 'Same daily reward twice in one day blocked');
}

{
  const now = new Date('2026-08-10T12:00:00');
  const token = generateInviteToken();
  assert.ok(token.length >= 22, '≥128 bits entropy');
  let invites = [
    createMemberInvite({
      householdId: 'hh',
      memberId: 'maya',
      createdBy: 'admin',
      token,
      now,
    }),
  ];
  assert.equal(validateMemberInvite(invites[0], now).ok, true);
  const later = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  const expired = validateMemberInvite(invites[0], later);
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.match(expired.message, /expired after 7 days/i);
  pass('F3.3', 'Token expires at 7 days with clear message');
}

{
  const now = new Date();
  let invites = [
    createMemberInvite({
      householdId: 'hh',
      memberId: 'maya',
      createdBy: 'admin',
      token: 'tok1',
      now,
    }),
  ];
  invites = [markInviteUsed(invites[0], now)];
  const second = validateMemberInvite(invites[0], now);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.reason, 'used');
  pass('F3.4', 'Single-use — second redemption rejected');
}

{
  const now = new Date();
  let invites = [
    createMemberInvite({
      householdId: 'hh',
      memberId: 'maya',
      createdBy: 'admin',
      token: 'old',
      now,
    }),
  ];
  invites = revokePreviousInvites(invites, 'maya', now);
  invites = [
    ...invites,
    createMemberInvite({
      householdId: 'hh',
      memberId: 'maya',
      createdBy: 'admin',
      token: 'new',
      now: new Date(now.getTime() + 1000),
    }),
  ];
  assert.ok(invites[0].revokedAt);
  assert.equal(activeInviteForMember(invites, 'maya', now)?.token, 'new');
  pass('F3.5', 'Regenerating revokes previous token');
}

{
  assert.equal(alreadyOnDeviceMessage('Maya'), 'Maya is already on this device.');
  pass('F3.8', 'Friendly already-on-device message');
}

{
  const now = new Date('2026-08-10T12:00:00');
  const recent = task({
    id: 'e1',
    status: 'Expired',
    expiredAt: '2026-08-09T00:00:00.000Z',
    occurrenceDate: '2026-08-09',
  });
  const old = task({
    id: 'e2',
    status: 'Expired',
    expiredAt: '2026-07-01T00:00:00.000Z',
    occurrenceDate: '2026-07-01',
  });
  assert.equal(isExpiredVisibleInTab(recent, now), true);
  assert.equal(isExpiredVisibleInTab(old, now), false);
  assert.equal(isActiveTask(recent), false);
  assert.equal(groupExpiredByDay([recent, old], now).length, 1);
  pass('F5.3', 'Expired 8+ days ago hidden from tab but row kept');
}

console.log('test:revision-f-features OK');
