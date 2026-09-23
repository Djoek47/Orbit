/**
 * WO12 §C4 — slot order follows the sentence.
 * Run: npx tsx lib/poppins/slot-order.test.ts
 */
import assert from 'node:assert/strict';

import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { applySlotOrder, deriveFocusSlot, type SlotKey } from '@/lib/poppins/slot-order';
import { canAcceptModelSlotPatch } from '@/lib/poppins/slot-order';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';

const members = ['Mia', 'Sylla', 'Noah'];

function taskPayload(utterance: string): IuiPayload {
  const acts = parseCompoundHouseholdIntent(utterance, { memberNames: members });
  const task = acts.find((a) => String(a.type) === 'create_task_draft');
  assert.ok(task, `expected task for: ${utterance} got ${JSON.stringify(acts)}`);
  const playlist = mapUiActionsToPlaylist([task!]);
  const beat = playlist.find((b) => b.scene === 'task_compose');
  assert.ok(beat, 'task_compose beat');
  return beat!.payload;
}

function assertOrder(payload: IuiPayload, expected: SlotKey[], focus: SlotKey) {
  assert.deepEqual(payload.slotOrder, expected, `slotOrder for focus=${focus}`);
  assert.equal(payload.focusSlot, focus, `focusSlot`);
}

// Canvas SlotOrder board — three sentences.
{
  const p = taskPayload('add the dishes for Mia');
  assertOrder(p, ['title', 'assignee'], 'due');
  assert.equal(p.title, 'Dishes');
  assert.equal(p.assignee, 'Mia');
  assert.ok(!p.due);
}

{
  const p = taskPayload('Mia should do the dishes');
  assertOrder(p, ['assignee', 'title'], 'due');
  assert.equal(p.assignee, 'Mia');
  assert.match(String(p.title), /dishes/i);
  assert.ok(!p.due);
}

{
  const p = taskPayload('tomorrow, someone needs to do the dishes');
  assertOrder(p, ['due', 'title'], 'assignee');
  assert.equal(p.due, 'Tomorrow');
  assert.match(String(p.title), /dishes/i);
  assert.ok(!p.assignee);
}

// WO12 §H3 — cleaning task + tomorrow → who in focus.
{
  const p = taskPayload('add a cleaning task for the dishes tomorrow');
  assert.ok(p.slotOrder?.includes('title'));
  assert.ok(p.slotOrder?.includes('due'));
  assert.equal(p.focusSlot, 'assignee');
}

// Model patch for a spoken slot is dropped.
{
  const spoken: IuiPayload = {
    title: 'Dishes',
    assignee: 'Mia',
    slotOrder: ['title', 'assignee'],
    focusSlot: 'due',
    slotSource: { title: 'speech', assignee: 'speech' },
  };
  assert.equal(canAcceptModelSlotPatch(spoken, 'title'), false);
  assert.equal(canAcceptModelSlotPatch(spoken, 'assignee'), false);
  assert.equal(canAcceptModelSlotPatch(spoken, 'due'), true);
}

// Touch on a filled slot still edits it (touch is allowed; model is not).
{
  const spoken: IuiPayload = {
    title: 'Dishes',
    assignee: 'Mia',
    slotOrder: ['title', 'assignee'],
    focusSlot: 'due',
    slotSource: { title: 'speech', assignee: 'speech' },
  };
  const next = applySlotOrder(
    { ...spoken, assignee: 'Sylla', slotSource: { ...spoken.slotSource, assignee: 'touch' } },
    { filled: [{ key: 'assignee', at: 0 }] }
  );
  assert.equal(next.assignee, 'Sylla');
  assert.equal(next.slotSource?.assignee, 'touch');
  assert.ok(next.slotOrder?.includes('assignee'));
}

{
  assert.equal(deriveFocusSlot({ title: 'Dishes', due: 'Tomorrow', slotOrder: ['title', 'due'] }), 'assignee');
  assert.equal(deriveFocusSlot({ title: 'Dishes', assignee: 'Mia', due: 'Today', slotOrder: ['title', 'assignee', 'due'] }), null);
}

console.log('slot-order.test.ts ok');
