/**
 * Run: npx --yes tsx lib/poppins/iui-act-notification.test.ts
 */
import assert from 'node:assert/strict';

import {
  isNotificationApprovable,
  serializeIuiActNotification,
  isIuiActExpired,
} from '@/lib/poppins/iui-act-notification';
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
assert.equal(isNotificationApprovable(taskBeat, 'Maya'), false, 'other person not approvable');

const grocery: IuiBeat = {
  ...taskBeat,
  id: 'b2',
  scene: 'grocery_add',
  payload: { groceryName: 'Milk', write: 'add_grocery' },
};
assert.equal(isNotificationApprovable(grocery), true);

const serialized = serializeIuiActNotification({
  beat: taskBeat,
  householdId: 'hh1',
  recipientName: 'Drako',
  now: Date.parse('2026-09-17T12:00:00.000Z'),
});
assert.equal(serialized.data.kind, 'iui_act');
assert.equal(serialized.data.approvable, true);
assert.match(serialized.body, /Clean dishes/);
assert.equal(isIuiActExpired(serialized.data, Date.parse('2026-09-17T12:00:00.000Z')), false);
assert.equal(isIuiActExpired(serialized.data, Date.parse('2026-09-17T13:00:00.000Z')), true);

console.log('PASS iui-act-notification');
