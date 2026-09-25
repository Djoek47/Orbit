/**
 * WO11 §3 — beat maths: one HOLD per group, N rows.
 * Run: npx tsx lib/poppins/iui-timings.test.ts
 */
import assert from 'node:assert/strict';

import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import {
  HOLD_MS_DEFAULT,
  HOLD_MS_KID,
  RESULT_LINGER_MS,
  SETTLE_CLEAR_MS,
  SHOW_MS,
  SPEECH_QUIET_MS,
} from '@/lib/poppins/ui-scenes';

const members = ['Mia', 'Sylla'];

function holdsFor(utterance: string) {
  const acts = parseCompoundHouseholdIntent(utterance, { memberNames: members });
  const playlist = mapUiActionsToPlaylist(acts);
  return playlist.filter((beat) => beat.commit === 'hold');
}

{
  const holds = holdsFor('add milk, eggs and bread');
  assert.equal(holds.length, 1, 'one HOLD for three groceries');
  assert.equal(holds[0]?.payload.items?.filter((i) => !i.dropped).length, 3);
}

{
  const holds = holdsFor('assign dishes to Mia and vacuum to Sylla for tomorrow');
  assert.equal(holds.length, 1, 'one HOLD for two tasks');
  assert.equal(holds[0]?.payload.items?.length, 2);
}

{
  const holds = holdsFor('add coffee and assign the dishes to Mia tomorrow');
  assert.equal(holds.length, 2, 'mixed kinds → two HOLDs');
  assert.equal(holds[0]?.scene, 'grocery_add');
  assert.equal(holds[1]?.scene, 'task_compose');
}

// Budget math (local parse path, one group of 3): show + quiet + one hold + settle clear
const groupMs =
  SHOW_MS + SPEECH_QUIET_MS + HOLD_MS_DEFAULT + SETTLE_CLEAR_MS;
assert.ok(groupMs <= 1500, `group settle budget ${groupMs}ms ≤ 1500`);

const threeSerialOld =
  3 * (SHOW_MS + SPEECH_QUIET_MS + HOLD_MS_DEFAULT) + RESULT_LINGER_MS;
assert.ok(threeSerialOld > 1500, 'old serial path exceeded budget (sanity)');

assert.ok(HOLD_MS_KID > HOLD_MS_DEFAULT);

console.log('iui-timings.test.ts ok', { groupMs, threeSerialOld });
