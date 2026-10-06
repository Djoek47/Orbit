/**
 * Smart reassignment policy — before vs after household deadline.
 */
import assert from 'node:assert/strict';

import { wallTimeToUtc } from '@/lib/tasks/household-tz';
import { applyReassignmentPlan, planTaskReassignment } from '@/lib/tasks/reassign-policy';
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
    difficulty: 'easy',
    repeat: 'Daily',
    description: '',
    ...overrides,
  } as HouseholdTask;
}

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
  assert.equal(plan.mode, 'same_day');
  assert.equal(plan.dropsFromPreviousDenominator, true);
  const next = applyReassignmentPlan(task(), plan);
  assert.equal(next.assignee, 'Jack');
  assert.equal(next.occurrenceDate, '2026-09-20');
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
  assert.equal(plan.mode, 'next_day');
  const next = applyReassignmentPlan(task({ status: 'Overdue' }), plan);
  assert.equal(next.assignee, 'Jack');
  assert.equal(next.status, 'Pending');
  assert.equal(next.occurrenceDate, '2026-09-21');
  assert.equal(next.due, 'Tomorrow');
  assert.equal(next.completedLate, false);
}

{
  const plan = planTaskReassignment({
    task: task({ status: 'Expired' }),
    newAssigneeName: 'Jack',
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
  });
  assert.equal(plan.ok, false);
  if (plan.ok) throw new Error('expected blocked');
  assert.equal(plan.reason, 'expired');
}

{
  const plan = planTaskReassignment({
    task: task({ status: 'Completed' }),
    newAssigneeName: 'Jack',
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
  });
  assert.equal(plan.ok, false);
  if (plan.ok) throw new Error('expected blocked');
  assert.equal(plan.reason, 'completed');
}

{
  const plan = planTaskReassignment({
    task: task(),
    newAssigneeName: 'Emma',
    dailyDeadlineHm: '19:00',
    timezone: 'America/Toronto',
  });
  assert.equal(plan.ok, false);
  if (plan.ok) throw new Error('expected blocked');
  assert.equal(plan.reason, 'same_assignee');
}

console.log('test:reassign-policy OK');
