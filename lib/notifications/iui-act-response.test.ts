/**
 * Run: npx --yes tsx lib/notifications/iui-act-response.test.ts
 */
import assert from 'node:assert/strict';

import {
  isNotificationApprovable,
  serializeIuiActNotification,
  isIuiActExpired,
} from '@/lib/poppins/iui-act-notification';
import { continuityFromIuiAct } from '@/lib/poppins/iui-continuity';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';

const taskBeat: IuiBeat = {
  id: 'b1',
  scene: 'task_compose',
  phase: 'unfold',
  commit: 'hold',
  payload: {
    title: 'Clean dishes',
    assignee: 'Drako',
    due: 'Tomorrow',
    write: 'create_task',
  },
};

assert.equal(isNotificationApprovable(taskBeat, 'Drako'), true);
assert.equal(isNotificationApprovable(taskBeat, 'Maya'), false);

const continuity = continuityFromIuiAct({
  householdId: 'hh1',
  beat: taskBeat,
});
assert.equal(continuity.openFrozen, true);
assert.equal(continuity.openPlaylist?.[0]?.id, 'b1');

const serialized = serializeIuiActNotification({
  beat: taskBeat,
  householdId: 'hh1',
  recipientName: 'Drako',
  now: Date.parse('2026-09-17T12:00:00.000Z'),
});
assert.equal(isIuiActExpired(serialized.data, Date.parse('2026-09-17T12:29:00.000Z')), false);
assert.equal(isIuiActExpired(serialized.data, Date.parse('2026-09-17T12:31:00.000Z')), true);

console.log('PASS iui-act-response continuity + expiry');
