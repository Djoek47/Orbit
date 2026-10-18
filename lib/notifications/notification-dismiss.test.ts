/**
 * Per-member notification dismiss helpers.
 */
import assert from 'node:assert/strict';

import { isDismissedNotification, withMemberDismissed } from '@/lib/ai/daily-insight';

{
  const base = { data: { kind: 'task_assigned' } };
  assert.equal(isDismissedNotification(base), false);
  assert.equal(isDismissedNotification(base, 'm1'), false);

  const legacy = { data: { dismissed: true } };
  assert.equal(isDismissedNotification(legacy, 'm1'), true, 'legacy global dismiss');

  const per = { data: withMemberDismissed({}, 'm1') };
  assert.equal(isDismissedNotification(per, 'm1'), true);
  assert.equal(isDismissedNotification(per, 'm2'), false, 'other member still sees it');
  assert.deepEqual(per.data.dismissedByMemberIds, ['m1']);

  const again = withMemberDismissed(per.data, 'm1');
  assert.deepEqual(again.dismissedByMemberIds, ['m1'], 'idempotent');

  console.log('test:notification-dismiss OK');
}
