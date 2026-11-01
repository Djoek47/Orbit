/**
 * WO8 §3 validateAct — Run: npx --yes tsx lib/poppins/validate-act.test.ts
 */
import assert from 'node:assert/strict';

import { clearRejectedSlot, validateAct } from '@/lib/poppins/validate-act';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';

function taskPayload(partial: Partial<IuiPayload>): IuiPayload {
  return { write: 'create_task', ...partial };
}

{
  const r = validateAct(taskPayload({ title: 'something' }), 'task_compose');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'placeholder');
}

{
  const r = validateAct(taskPayload({ title: 'Task' }), 'task_compose');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'placeholder');
}

{
  const r = validateAct(taskPayload({ title: '' }), 'task_compose');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'missing');
}

{
  const r = validateAct(taskPayload({ title: undefined }), 'task_compose');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'missing');
}

{
  const utterance = 'add go to store on the list';
  const r = validateAct(
    { write: 'add_grocery', groceryName: 'add go to store on the list', sourceUtterance: utterance },
    'grocery_add'
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reason === 'command' || r.reason === 'echo');
}

{
  const utterance = 'please set up the dishes for drako tomorrow';
  const r = validateAct(
    taskPayload({ title: utterance, sourceUtterance: utterance }),
    'task_compose'
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reason === 'echo' || r.reason === 'command');
}

{
  const r = validateAct(taskPayload({ title: 'Clean dishes' }), 'task_compose');
  assert.equal(r.ok, true);
}

{
  const r = validateAct(
    taskPayload({ title: 'Clean dishes', provisional: true }),
    'task_compose'
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'unconfident');
}

{
  const r = validateAct(
    taskPayload({ libraryTaskId: 'lib-dishes', title: undefined }),
    'task_compose'
  );
  assert.equal(r.ok, true, 'library id alone is enough');
}

{
  const cleared = clearRejectedSlot(
    taskPayload({ title: 'something', assignee: 'Drako', due: 'Tomorrow' }),
    'title'
  );
  assert.equal(cleared.title, undefined);
  assert.equal(cleared.assignee, 'Drako');
  assert.equal(cleared.composeReady, false);
}

console.log('PASS validateAct');
