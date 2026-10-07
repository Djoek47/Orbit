/**
 * Unit tests for late-assign occurrence (after daily deadline → tomorrow).
 */
import assert from 'node:assert/strict';

import { resolveAssignOccurrence } from '@/lib/tasks/assign-occurrence';
import { buildLibraryAssignInput } from '@/lib/tasks/assign-from-library';
import { formatDateInTimezone, wallTimeToUtc } from '@/lib/tasks/household-tz';
import { addCalendarDays } from '@/lib/tasks/household-tz';
import type { LibraryTask } from '@/lib/tasks/task-library';

const task: LibraryTask = {
  id: 'load_the_dishwasher',
  name: 'Load the dishwasher',
  domainId: 'kitchen_dining',
  groupId: 'do_the_dishes',
  tracking: 'xp',
  xp: 10,
  defaultFrequency: 'daily',
  searchTerms: [],
};

{
  const before = wallTimeToUtc('2026-09-20', '18:00', 'America/Toronto');
  const resolved = resolveAssignOccurrence({
    now: before,
    dailyDeadlineHm: '21:00',
    timezone: 'America/Toronto',
  });
  assert.equal(resolved.occurrenceDate, '2026-09-20');
  assert.equal(resolved.rolledToTomorrow, false);
  assert.equal(resolved.dueLabel, 'Today');
}

{
  const after = wallTimeToUtc('2026-09-20', '21:00', 'America/Toronto');
  const resolved = resolveAssignOccurrence({
    now: after,
    dailyDeadlineHm: '21:00',
    timezone: 'America/Toronto',
  });
  assert.equal(resolved.occurrenceDate, '2026-09-21');
  assert.equal(resolved.rolledToTomorrow, true);
  assert.equal(resolved.dueLabel, 'Tomorrow');
}

{
  const after = wallTimeToUtc('2026-09-20', '21:58', 'America/Toronto');
  const input = buildLibraryAssignInput(task, 'Maya', 'weekly', {
    now: after,
    dailyDeadlineHm: '21:00',
    dueTimeLocal: '21:00',
    timezone: 'America/Toronto',
  });
  assert.equal(input.occurrenceDate, '2026-09-21');
  assert.equal(input.due, 'Tomorrow');
  assert.equal(input.repeat, 'Weekly');
}

{
  // Before deadline still today even for weekly library frequency.
  const morning = wallTimeToUtc('2026-09-20', '10:00', 'America/Toronto');
  const input = buildLibraryAssignInput(task, 'Emma', 'weekly', {
    now: morning,
    dailyDeadlineHm: '21:00',
    timezone: 'America/Toronto',
  });
  assert.equal(input.occurrenceDate, formatDateInTimezone(morning, 'America/Toronto'));
  assert.equal(input.due, 'Today');
}

{
  assert.equal(addCalendarDays('2026-09-20', 1), '2026-09-21');
}

console.log('test:assign-occurrence OK');
