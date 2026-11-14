/**
 * Recurrence uniqueness — `npx tsx lib/tasks/recurring.test.ts`
 */

import {
  ensureOccurrencesForDay,
  seriesDefinitionId,
  spawnNextOccurrence,
} from '@/lib/tasks/recurring';
import type { HouseholdTask } from '@/types/orbit';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const daily: HouseholdTask = {
  id: 'def-1',
  title: 'Wipe counters',
  category: 'kitchen_dining',
  assignee: 'Emma',
  due: 'Yesterday',
  xp: 10,
  repeat: 'Daily',
  status: 'Completed',
  definitionId: 'series:wipe',
  occurrenceDate: '2026-07-31',
  completedAt: '2026-07-31T20:00:00.000Z',
};

assert(spawnNextOccurrence(daily) === null, 'completion must not spawn');

const day = new Date(2026, 7, 2); // Aug 2 local
const first = ensureOccurrencesForDay([daily], day);
assert(first.length === 1, 'creates one occurrence for the day');
assert(first[0].occurrenceDate === '2026-08-02', 'occurrence date keyed');
assert(first[0].definitionId === 'series:wipe', 'keeps definition id');

const withExisting: HouseholdTask = {
  ...first[0],
  id: 'occ-today',
  status: 'Pending',
};
const second = ensureOccurrencesForDay([daily, withExisting], day);
assert(second.length === 0, 'idempotent — no double insert');

const legacyOpen: HouseholdTask = {
  id: 'legacy',
  title: 'Wipe counters',
  category: 'kitchen_dining',
  assignee: 'Emma',
  due: 'Today',
  xp: 10,
  repeat: 'Daily',
  status: 'Pending',
};
assert(seriesDefinitionId(legacyOpen).includes('Wipe counters'), 'legacy series id');
const legacyDay = ensureOccurrencesForDay([legacyOpen], new Date());
assert(legacyDay.length === 0, 'legacy open Today counts as existing');

const createdToday: HouseholdTask = {
  id: 'new-daily',
  title: 'New daily',
  category: 'kitchen_dining',
  assignee: 'Emma',
  due: 'Today',
  xp: 10,
  repeat: 'Daily',
  status: 'Pending',
  definitionId: 'lib:new-daily:Emma',
  occurrenceDate: '2026-08-02',
  dueAt: new Date(2026, 7, 2, 19, 0, 0).toISOString(),
};
const yesterdayOfCreate = new Date(2026, 7, 1);
const noYesterday = ensureOccurrencesForDay([createdToday], yesterdayOfCreate);
assert(noYesterday.length === 0, 'new daily today must not expire/create yesterday');

const weeklyNew: HouseholdTask = {
  id: 'new-weekly',
  title: 'Sunday bins',
  category: 'trash_recycling',
  assignee: 'Emma',
  due: 'Today',
  xp: 10,
  repeat: 'Weekly',
  status: 'Pending',
  definitionId: 'lib:bins:Emma',
  occurrenceDate: '2026-08-09', // this Sunday
  dueAt: new Date(2026, 7, 9, 19, 0, 0).toISOString(),
};
const lastSunday = new Date(2026, 7, 2);
const noLastSunday = ensureOccurrencesForDay([weeklyNew], lastSunday);
assert(noLastSunday.length === 0, 'new weekly must not create last Sunday');

console.log('test:recurring OK');
