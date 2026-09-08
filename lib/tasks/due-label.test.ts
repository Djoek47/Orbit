import assert from 'node:assert/strict';

import {
  displayDueLabel,
  dueLabelForDate,
  occurrenceDateForDueLabel,
  refreshStaleDueLabels,
  resolveOccurrenceDate,
} from '@/lib/tasks/due-label';
import type { HouseholdTask } from '@/types/orbit';

const monday = new Date('2026-08-24T12:00:00');
const tuesday = new Date('2026-08-25T12:00:00');

assert.equal(occurrenceDateForDueLabel('Tomorrow', monday), '2026-08-25');
assert.equal(dueLabelForDate('2026-08-25', monday), 'Tomorrow');
assert.equal(dueLabelForDate('2026-08-25', tuesday), 'Today');

const stickyTomorrow: Pick<HouseholdTask, 'due' | 'occurrenceDate' | 'dueAt' | 'status'> = {
  due: 'Tomorrow',
  occurrenceDate: '2026-08-25',
  status: 'Pending',
};

assert.equal(displayDueLabel(stickyTomorrow, monday), 'Tomorrow');
assert.equal(displayDueLabel(stickyTomorrow, tuesday), 'Today');
assert.equal(resolveOccurrenceDate(stickyTomorrow, tuesday), '2026-08-25');

const refreshed = refreshStaleDueLabels(
  [
    {
      id: 't1',
      title: 'Dishes',
      assignee: 'Alex',
      due: 'Tomorrow',
      occurrenceDate: '2026-08-25',
      status: 'Pending',
      category: 'kitchen_dining',
      xp: 10,
      repeat: 'None',
    } as HouseholdTask,
  ],
  tuesday
);
assert.equal(refreshed[0]?.due, 'Today');

console.log('due-label tests passed');
