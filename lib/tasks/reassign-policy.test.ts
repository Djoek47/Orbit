/**
 * Smart reassignment — grace night + next day full XP; this-occurrence series.
 */
import assert from 'node:assert/strict';

import { wallTimeToUtc } from '@/lib/tasks/household-tz';
import {
  applyReassignmentPlan,
  carryReassignedOvernight,
  effectiveDueAtForAward,
  planTaskReassignment,
} from '@/lib/tasks/reassign-policy';
import { resolveCompletionXp } from '@/lib/tasks/xp';
import type { HouseholdTask } from '@/types/orbit';

function task(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  return {
    id: 't1',
    title: 'Unload dishwasher',
    category: 'Kitchen',
    assignee: 'Emma',
    status: 'Pending',
    due: 'Today',
    dueAt: wallTimeToUtc('2026-09-20', '19:00', 'America/Toronto').toISOString(),
    occurrenceDate: '2026-09-20',
    xp: 10,
    baseXp: 10,
    xpEligible: true,
    tracking: 'xp',
    difficulty: 'easy',
    repeat: 'Daily',
    description: '',
    ...overrides,
  } as HouseholdTask;
}

const settings = { rewardMode: 'weighted' as const, hygieneRewarded: false, hygieneXp: 5 as const };

{
  const before = wallTimeToUtc('2026-09-20', '16:00', 'America/Toronto');
  const plan = planTaskReassignment({
    task: task(),
    newAssigneeName: 'Jack',
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
    now: before,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) throw new Error('expected ok');
  assert.equal(plan.mode, 'same_day_grace');
  assert.equal(plan.seriesScope, 'this');
  const next = applyReassignmentPlan(task(), plan);
  assert.equal(next.assignee, 'Jack');
  assert.equal(next.reassignedFrom, 'Emma');
  assert.equal(next.reassignCarriedOvernight, false);
  assert.ok(next.reassignFullXpUntil);
}

{
  const after = wallTimeToUtc('2026-09-20', '19:30', 'America/Toronto');
  const plan = planTaskReassignment({
    task: task({ status: 'Overdue' }),
    newAssigneeName: 'Jack',
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
    now: after,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) throw new Error('expected ok');
  assert.equal(plan.mode, 'next_day_grace');
  const next = applyReassignmentPlan(task({ status: 'Overdue' }), plan);
  assert.equal(next.status, 'Pending');
  assert.equal(next.occurrenceDate, '2026-09-21');
  assert.equal(next.reassignCarriedOvernight, true);
}

{
  const open = task({
    reassignedAt: wallTimeToUtc('2026-09-20', '20:00', 'America/Toronto').toISOString(),
    reassignedFrom: 'Emma',
    assignee: 'Jack',
    reassignCarriedOvernight: false,
    reassignFullXpUntil: wallTimeToUtc('2026-09-21', '19:00', 'America/Toronto').toISOString(),
  });
  const carried = carryReassignedOvernight(open, '2026-09-20', {
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
    now: wallTimeToUtc('2026-09-21', '00:05', 'America/Toronto'),
  });
  assert.ok(carried);
  assert.equal(carried!.occurrenceDate, '2026-09-21');
  assert.equal(carried!.reassignCarriedOvernight, true);
  assert.equal(carried!.status, 'Pending');
}

{
  // Full XP on grace day even after original dueAt
  const grace = task({
    assignee: 'Jack',
    reassignedAt: '2026-09-20T23:00:00.000Z',
    reassignFullXpUntil: wallTimeToUtc('2026-09-21', '19:00', 'America/Toronto').toISOString(),
    dueAt: wallTimeToUtc('2026-09-20', '19:00', 'America/Toronto').toISOString(),
  });
  const duringGrace = resolveCompletionXp(
    grace,
    settings,
    wallTimeToUtc('2026-09-21', '18:00', 'America/Toronto')
  );
  assert.equal(duringGrace.awarded, 10, 'full XP during grace');
  assert.equal(duringGrace.completedLate, false);

  const afterGrace = resolveCompletionXp(
    grace,
    settings,
    wallTimeToUtc('2026-09-21', '20:00', 'America/Toronto')
  );
  assert.equal(afterGrace.awarded, 7, 'Late Credit only after grace deadline');
  assert.equal(afterGrace.completedLate, true);
}

{
  assert.equal(
    effectiveDueAtForAward({ dueAt: 'a', reassignFullXpUntil: 'b' }),
    'b'
  );
}

{
  const plan = planTaskReassignment({
    task: task({ status: 'Expired' }),
    newAssigneeName: 'Jack',
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
  });
  assert.equal(plan.ok, false);
  if (plan.ok) throw new Error('blocked');
  assert.equal(plan.reason, 'expired');
}

console.log('test:reassign-policy OK');
