/**
 * A task is in one state. It was reading two clocks and contradicting itself:
 * "Pending · Late" and "Expired · Late" both appeared on the same screen.
 *
 * Run: npx tsx lib/tasks/task-state.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canFinishTask, taskState, taskStateView, wouldEarnLateCredit } from '@/lib/tasks/task-state';
import type { HouseholdTask } from '@/types/orbit';

const NOW = new Date('2026-09-30T20:00:00Z');
const task = (extra: Partial<HouseholdTask>): HouseholdTask =>
  ({ id: 't', title: 'Wash dishes', due: 'Today', status: 'Pending', ...extra }) as HouseholdTask;

// Before the deadline: due, and finishable.
const due = task({ dueAt: '2026-09-30T22:00:00Z' });
assert.equal(taskState(due, NOW), 'due');
assert.equal(taskStateView(due, NOW).label, 'Due today');
assert.equal(canFinishTask(due, NOW), true);

// Past the deadline but the day hasn't closed: overdue — never "Pending · Late".
const past = task({ dueAt: '2026-09-30T16:00:00Z' });
assert.equal(taskState(past, NOW), 'overdue');
assert.equal(taskStateView(past, NOW).label, 'Overdue');
assert.equal(canFinishTask(past, NOW), true, 'still finishable, for less XP');

// The day closed: expired, terminal, and never also late.
for (const status of ['Expired', 'Missed'] as const) {
  const gone = task({ status, dueAt: '2026-09-29T16:00:00Z' });
  assert.equal(taskState(gone, NOW), 'expired');
  assert.equal(taskStateView(gone, NOW).label, 'Expired');
  assert.equal(canFinishTask(gone, NOW), false, 'expired work is finished with');
  assert.equal(taskStateView(gone, NOW).terminal, true);
}

// Done. Late Credit describes the XP, not the state of the work.
const onTime = task({ status: 'Completed', completedAt: '2026-09-30T15:00:00Z' });
assert.equal(taskState(onTime, NOW), 'done');
const lateDone = task({ status: 'Completed', completedLate: true, dueAt: '2026-09-30T16:00:00Z' });
assert.equal(taskState(lateDone, NOW), 'done-late');
assert.equal(canFinishTask(lateDone, NOW), false);

// Skipped today.
assert.equal(taskState(task({ status: 'Cancelled' }), NOW), 'skipped');

// Every state is exactly one of the labels, and no label says two things.
for (const sample of [due, past, onTime, lateDone, task({ status: 'Expired' })]) {
  const view = taskStateView(sample, NOW);
  assert.ok(!/·|,| and /.test(view.label), `one thing, not two: "${view.label}"`);
  assert.equal(view.open, !view.terminal, 'open and terminal are opposites');
}

// Late Credit only ever applies to work that is still open and past its deadline.
assert.equal(wouldEarnLateCredit(past, NOW), true);
assert.equal(wouldEarnLateCredit(due, NOW), false);
assert.equal(wouldEarnLateCredit(task({ status: 'Expired' }), NOW), false);

// The screen reads this, and only this.
const page = readFileSync(join(process.cwd(), 'app/task/[id].tsx'), 'utf8');
assert.match(page, /taskStateView\(task\)/, 'one reading');
assert.doesNotMatch(page, /isTaskLate/, 'the second clock is gone');
assert.doesNotMatch(page, />Late</, 'and so is the separate Late chip');
assert.match(page, /stateView\.state === 'done-late'/, 'Late Credit shows only on finished work');
assert.match(page, /canFinishTask\(task\)/, 'one answer for whether it can be completed');
assert.match(
  page,
  /permissions\.canManageHousehold \|\|/,
  'an admin can always close open work'
);

console.log('task-state: ok');
