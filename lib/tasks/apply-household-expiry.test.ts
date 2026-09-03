/**
 * Unit tests for household expiry helper.
 */
import assert from 'node:assert/strict';

import { applyHouseholdTaskExpiry, tasksWithExpiryStatusChange } from '@/lib/tasks/apply-household-expiry';
import type { HouseholdTask } from '@/types/orbit';

function task(overrides: Partial<HouseholdTask> & Pick<HouseholdTask, 'id'>): HouseholdTask {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Chore',
    category: overrides.category ?? 'chores',
    assignee: overrides.assignee ?? 'Maya',
    due: overrides.due ?? 'Yesterday',
    xp: overrides.xp ?? 10,
    repeat: overrides.repeat ?? 'None',
    status: overrides.status ?? 'Pending',
    occurrenceDate: overrides.occurrenceDate,
    dueAt: overrides.dueAt,
    expiredAt: overrides.expiredAt,
  };
}

{
  const now = new Date(2026, 8, 2, 8, 0, 0);
  const yesterday = task({
    id: 'y1',
    occurrenceDate: '2026-09-01',
    dueAt: new Date(2026, 8, 1, 19, 0, 0).toISOString(),
  });
  const household = { members: [{ id: 'm1', name: 'Maya' } as never], recessPeriods: [] };
  const next = applyHouseholdTaskExpiry([yesterday], household, now);
  assert.equal(next[0]?.status, 'Expired', 'yesterday pending → Expired after boundary');

  const changed = tasksWithExpiryStatusChange([yesterday], next);
  assert.equal(changed.length, 1);
  assert.ok(next[0]?.expiredAt, 'sets expiredAt stamp');
}

console.log('test:apply-household-expiry OK');
