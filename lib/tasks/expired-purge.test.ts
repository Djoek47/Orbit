/**
 * Run: npx --yes tsx lib/tasks/expired-purge.test.ts
 */
import assert from 'node:assert/strict';

import { isExpiredVisibleInTab } from '@/lib/tasks/expired-tab';
import type { HouseholdTask } from '@/types/orbit';

function task(partial: Partial<HouseholdTask> & Pick<HouseholdTask, 'id' | 'status'>): HouseholdTask {
  return {
    title: 'Test',
    category: 'home_maintenance',
    assignee: 'Maya',
    due: 'Today',
    xp: 10,
    repeat: 'None',
    difficulty: 'easy',
    weight: 1,
    ...partial,
  };
}

const now = new Date('2026-09-18T12:00:00.000Z');

{
  const eightDays = task({
    id: 'old',
    status: 'Expired',
    expiredAt: '2026-09-10T11:59:00.000Z',
    occurrenceDate: '2026-09-10',
  });
  assert.equal(isExpiredVisibleInTab(eightDays, now), false, '8d ago hidden');
}

{
  const sixDays = task({
    id: 'keep',
    status: 'Expired',
    expiredAt: '2026-09-12T12:00:00.000Z',
    occurrenceDate: '2026-09-12',
  });
  assert.equal(isExpiredVisibleInTab(sixDays, now), true, '6d ago visible');
}

{
  // Exactly 7 days ago is purge boundary (hidden in app before cron).
  const exactlySeven = task({
    id: 'edge',
    status: 'Expired',
    expiredAt: '2026-09-11T12:00:00.000Z',
    occurrenceDate: '2026-09-11',
  });
  assert.equal(isExpiredVisibleInTab(exactlySeven, now), false, 'exactly 7d hidden');
}

{
  const almostSeven = task({
    id: 'almost',
    status: 'Expired',
    expiredAt: '2026-09-11T12:01:00.000Z',
    occurrenceDate: '2026-09-11',
  });
  assert.equal(isExpiredVisibleInTab(almostSeven, now), true, '7d - 1m still visible');
}

{
  const completed = task({
    id: 'done',
    status: 'Completed',
    expiredAt: '2026-08-01T12:00:00.000Z',
  });
  assert.equal(isExpiredVisibleInTab(completed, now), false, 'completed never in expired tab');
}

console.log('PASS expired-purge visibility');
