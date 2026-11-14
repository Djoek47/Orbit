/**
 * WO10 A4 — local write beats get a confirmation without calling the model.
 * Run: npx tsx lib/poppins/local-act-confirm.test.ts
 */
import assert from 'node:assert/strict';

import {
  confirmationForLocalWrite,
  findLocalWriteBeat,
  isLocalWriteBeat,
} from '@/lib/poppins/local-act-confirm';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';

function beat(partial: Partial<IuiBeat> & { scene: IuiBeat['scene']; payload: IuiBeat['payload'] }): IuiBeat {
  return {
    id: 'b1',
    phase: 'show',
    commit: 'hold',
    ...partial,
  };
}

const grocery = beat({
  scene: 'grocery_add',
  payload: { write: 'add_grocery', groceryName: 'Jam', shoppingLane: 'grocery' },
});
assert.equal(isLocalWriteBeat(grocery), true);
assert.equal(confirmationForLocalWrite(grocery), 'Added Jam to Groceries.');

const task = beat({
  scene: 'task_compose',
  payload: {
    write: 'create_task',
    title: 'Clean Dishes',
    assignee: 'Mia',
    due: 'today',
  },
});
assert.equal(confirmationForLocalWrite(task), 'Assigned Clean Dishes to Mia for today.');

const done = beat({
  scene: 'task_done',
  payload: { write: 'complete_task', title: 'Trash' },
});
assert.equal(confirmationForLocalWrite(done), 'Marked Trash done.');

const event = beat({
  scene: 'calendar_zoom',
  payload: { write: 'create_event', title: 'Practice', date: 'Saturday', time: '4pm' },
});
assert.equal(confirmationForLocalWrite(event), 'Scheduled Practice for Saturday 4pm.');

const playlist = [
  beat({ scene: 'thinking', payload: { write: 'none' }, commit: 'none' }),
  grocery,
];
assert.equal(findLocalWriteBeat(playlist, 0)?.payload.groceryName, 'Jam');

console.log('local-act-confirm.test.ts ok');
