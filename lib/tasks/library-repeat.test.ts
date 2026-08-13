import assert from 'node:assert/strict';

import { mapLibraryRepeat } from './library-repeat';
import { dueLabelForDate, libraryDefinitionId, occurrenceDateForDueLabel } from './due-label';
import { buildLibraryAssignInput } from './assign-from-library';
import type { LibraryTask } from './task-library';

assert.equal(mapLibraryRepeat('daily'), 'Daily');
assert.equal(mapLibraryRepeat('weekly'), 'Weekly');
assert.equal(mapLibraryRepeat('2x_weekly'), 'Weekly');
assert.equal(mapLibraryRepeat('monthly'), 'None');
assert.equal(mapLibraryRepeat('quarterly'), 'None');
assert.equal(mapLibraryRepeat('as_needed'), 'None');
assert.equal(libraryDefinitionId('load_the_dishwasher', 'Emma'), 'lib:load_the_dishwasher:Emma');

const now = new Date(2026, 7, 13);
assert.equal(dueLabelForDate('2026-08-13', now), 'Today');
assert.equal(dueLabelForDate('2026-08-14', now), 'Tomorrow');
assert.equal(occurrenceDateForDueLabel('Today', now), '2026-08-13');
assert.equal(occurrenceDateForDueLabel('Tomorrow', now), '2026-08-14');

const sample: LibraryTask = {
  id: 'take_out_the_garbage',
  name: 'Take out the garbage',
  domainId: 'trash_recycling',
  groupId: 'take_out_the_trash',
  tracking: 'xp',
  xp: 10,
  defaultFrequency: 'weekly',
  searchTerms: [],
};
const assigned = buildLibraryAssignInput(sample, 'Maya', 'weekly', now);
assert.equal(assigned.due, 'Today');
assert.equal(assigned.occurrenceDate, '2026-08-13');
assert.equal(assigned.repeat, 'Weekly');

console.log('library-repeat + due-label: ok');
