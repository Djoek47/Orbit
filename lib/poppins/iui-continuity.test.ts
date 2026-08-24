/**
 * Speak continuity — hangup must not wipe the household conversation.
 * Run: npx tsx lib/poppins/iui-continuity.test.ts
 */

import {
  continuityListenPrompt,
  hasOpenAct,
  isContinuityFresh,
  rememberTurn,
  shouldGreet,
  snapshotFromDrive,
  type IuiContinuity,
} from '@/lib/poppins/iui-continuity';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const beat = {
  id: 'b1',
  scene: 'task_compose',
  phase: 'hold',
  commit: 'hold',
  payload: { title: 'Dishes', assignee: 'Maya', write: 'create_task' },
} as IuiBeat;

const base: IuiContinuity = {
  householdId: 'hh1',
  updatedAt: Date.now(),
  turns: [],
};

assert(isContinuityFresh(base), 'fresh');
assert(!isContinuityFresh({ ...base, updatedAt: Date.now() - 5 * 60 * 60 * 1000 }), 'stale 5h');
assert(shouldGreet(null, 'hh1'), 'first session greets');
assert(!shouldGreet(base, 'hh1'), 'return does not greet');
assert(shouldGreet(base, 'hh-other'), 'other household greets');

const withTurn = rememberTurn(base, 'hh1', { role: 'user', text: 'Assign dishes to Maya' });
assert(withTurn.turns.length === 1, 'first turn');
const merged = rememberTurn(withTurn, 'hh1', { role: 'user', text: 'Assign dishes to Maya tomorrow' });
assert(merged.turns.length === 1, 'same role replaces');
assert(merged.turns[0]?.text.includes('tomorrow'), 'replaced text');

const snapped = snapshotFromDrive(merged, 'hh1', {
  live: true,
  playlist: [beat],
  index: 0,
  frozen: false,
  holding: true,
  phase: 'hold',
});
assert(snapped.lastAssignee === 'Maya', 'assignee');
assert(snapped.lastTitle === 'Dishes', 'title');
assert(hasOpenAct(snapped), 'open HOLD kept');
assert(snapped.openFrozen === true, 'hangup freezes');

const idle = snapshotFromDrive(merged, 'hh1', {
  live: false,
  playlist: [],
  index: 0,
  frozen: false,
  holding: false,
  phase: 'show',
});
assert(!hasOpenAct(idle), 'idle has no open act');

const prompt = continuityListenPrompt(snapped);
assert(prompt.includes('Do not greet'), 'no greet');
assert(prompt.includes('Maya'), 'remembers who');
assert(prompt.includes('on screen'), 'open act');

console.log('PASS iui-continuity hangup remembers the act');
