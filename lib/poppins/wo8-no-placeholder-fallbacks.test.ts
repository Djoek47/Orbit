/**
 * WO8 Pass 1 — four placeholder fallbacks must not invent titles.
 * Run: npx --yes tsx lib/poppins/wo8-no-placeholder-fallbacks.test.ts
 */
import assert from 'node:assert/strict';

import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';

{
  const playlist = mapUiActionsToPlaylist([
    { type: 'complete_task', taskId: 't1' },
  ]);
  const beat = playlist[0];
  assert.ok(beat);
  assert.equal(beat.payload.title, undefined, 'complete_task must not default title to Task');
}

{
  const playlist = mapUiActionsToPlaylist([
    { type: 'list_peek', rows: [{ id: '1' }] },
  ]);
  const row = playlist[0]?.payload.peek?.[0];
  assert.ok(row);
  assert.equal(row.title, '', 'list_peek must not default title to Task');
}

{
  // Grocery meta library id without extractable name → no invented Item
  const actions = parseHouseholdIntent('set up the grocery list stuff', {
    memberNames: ['Maya'],
    selfName: 'Maya',
  });
  for (const action of actions) {
    if (String(action.type) === 'add_grocery') {
      assert.notEqual(String(action.name ?? '').toLowerCase(), 'item');
    }
    if (String(action.type)?.includes('task')) {
      assert.notEqual(String(action.title ?? '').toLowerCase(), 'item');
      assert.notEqual(String(action.title ?? '').toLowerCase(), 'task');
    }
  }
}

console.log('PASS wo8-no-placeholder-fallbacks');
