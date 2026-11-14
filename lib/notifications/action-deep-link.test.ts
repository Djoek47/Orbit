import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNotificationAction } from '@/lib/notifications/action-deep-link';

test('B3 proof notification opens task', () => {
  const target = resolveNotificationAction({ kind: 'proof_submitted', taskId: 't1', notificationId: 'N19' });
  assert.equal(target?.pathname, '/task/[id]');
  assert.equal(target?.params?.id, 't1');
});

test('B3 reward notification opens Rewards tab', () => {
  const target = resolveNotificationAction({ kind: 'reward_requested', rewardId: 'r1', notificationId: 'N26' });
  assert.equal(target?.pathname, '/(tabs)/rewards');
});

test('B3 unknown payload returns null', () => {
  assert.equal(resolveNotificationAction({}), null);
});
