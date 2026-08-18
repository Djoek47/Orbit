import assert from 'node:assert/strict';

import { isDueToday } from '@/lib/tasks/today';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { domainIconName } from '@/components/orbit/design/icon-map';
import { buildLibraryAssignInput } from './assign-from-library';
import { choreDomains, type LibraryTask } from './task-library';

const now = new Date(2026, 7, 13, 10, 0, 0); // Thursday
const task: LibraryTask = {
  id: 'load_the_dishwasher',
  name: 'Load the dishwasher',
  domainId: 'kitchen_dining',
  groupId: 'do_the_dishes',
  tracking: 'xp',
  xp: 10,
  defaultFrequency: 'weekly',
  searchTerms: [],
};

const weekly = buildLibraryAssignInput(task, 'Emma', 'weekly', now);
assert.equal(weekly.due, 'Today', 'first occurrence is today so Assign shows on Active');
assert.equal(weekly.occurrenceDate, formatLocalDate(now));
assert.equal(weekly.repeat, 'Weekly');
assert.equal(weekly.definitionId, 'lib:load_the_dishwasher:Emma');
assert.equal(weekly.assignee, 'Emma');
assert.equal(weekly.difficulty, 'medium');
assert.equal(weekly.weight, 1);
assert.ok(isDueToday({ status: 'Pending', due: weekly.due }), 'Today list must include a fresh assign');

const nextSunday = dueAtForFrequency('weekly', now);
assert.ok(nextSunday, 'weekly schedule exists');
assert.notEqual(
  weekly.occurrenceDate,
  formatLocalDate(nextSunday!),
  'do not park a new assign on next Sunday'
);

const monthly = buildLibraryAssignInput({ ...task, defaultFrequency: 'monthly' }, 'Josh', 'monthly', now);
assert.equal(monthly.due, 'Today');
assert.equal(monthly.repeat, 'None');
assert.equal(monthly.occurrenceDate, formatLocalDate(now));

for (const domain of choreDomains()) {
  assert.equal(typeof domainIconName(domain.id), 'string', domain.id);
}

console.log('assign-from-library: ok');
