/**
 * Run: npx tsx lib/tasks/series-edit.test.ts
 */

import assert from 'node:assert/strict';

import { isSameTaskSeries } from '@/lib/tasks/cancel';
import { ensureOccurrencesForDay, pickSeriesTemplate, seriesDefinitionId } from '@/lib/tasks/recurring';
import {
  applySeriesPatch,
  defaultSeriesScope,
  isSeriesRuleChange,
} from '@/lib/tasks/series-edit';
import type { HouseholdTask } from '@/types/orbit';

function task(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  return {
    id: 'today',
    title: 'Dishes',
    category: 'kitchen_dining',
    assignee: 'Maya',
    due: 'Today',
    xp: 10,
    repeat: 'Daily',
    status: 'Pending',
    definitionId: 'series:dishes-maya',
    occurrenceDate: '2026-08-24',
    ...overrides,
  };
}

const yesterday = task({
  id: 'yesterday',
  status: 'Completed',
  occurrenceDate: '2026-08-23',
  completedAt: '2026-08-23T18:00:00.000Z',
});
const today = task();

{
  assert.equal(defaultSeriesScope(today, { ...today, repeat: 'Weekdays' }), 'future');
  assert.equal(defaultSeriesScope(today, { ...today, xp: 20 } as HouseholdTask), 'this');
  assert.ok(isSeriesRuleChange(today, { ...today, repeat: 'Weekly' }));
}

{
  const patched = applySeriesPatch(
    [yesterday, today],
    today,
    { repeat: 'Weekdays' },
    'future'
  );
  const nextToday = patched.find((row) => row.id === 'today');
  const nextYesterday = patched.find((row) => row.id === 'yesterday');
  assert.equal(nextToday?.repeat, 'Weekdays');
  assert.equal(nextToday?.definitionId, 'series:dishes-maya');
  assert.equal(nextYesterday?.repeat, 'Daily', 'history stays Daily');
  assert.equal(isSameTaskSeries(nextToday!, nextYesterday!), true);
}

{
  const patched = applySeriesPatch([yesterday, today], today, { repeat: 'None' }, 'future');
  assert.equal(patched.find((row) => row.id === 'today')?.repeat, 'None');
  assert.equal(patched.find((row) => row.id === 'today')?.status, 'Pending', 'today stays');
}

{
  const later = task({ id: 'later', occurrenceDate: '2026-08-25', status: 'Pending' });
  const patched = applySeriesPatch([today, later], today, { repeat: 'None' }, 'future');
  assert.equal(patched.find((row) => row.id === 'later')?.status, 'Cancelled');
  assert.equal(patched.find((row) => row.id === 'later')?.repeat, 'None');
}

{
  const members = applySeriesPatch([yesterday, today], today, { repeat: 'Weekly' }, 'future');
  const template = pickSeriesTemplate(members);
  assert.equal(template?.repeat, 'Weekly');
  const wednesday = new Date(2026, 7, 26); // Wed
  const drafts = ensureOccurrencesForDay(members, wednesday);
  assert.equal(drafts.length, 0, 'Weekly does not spawn on Wednesday');
}

{
  const members = applySeriesPatch([yesterday, today], today, { repeat: 'None' }, 'future');
  assert.equal(pickSeriesTemplate(members), null, 'stopped series has no template');
  const tuesday = new Date(2026, 7, 25);
  assert.equal(ensureOccurrencesForDay(members, tuesday).length, 0, 'stopped series does not spawn');
}

{
  const skipped = { ...today, status: 'Cancelled' as const };
  const members = [yesterday, skipped];
  const template = pickSeriesTemplate(members);
  assert.equal(template?.repeat, 'Daily');
  const tomorrow = new Date(2026, 7, 25);
  const drafts = ensureOccurrencesForDay(members, tomorrow);
  assert.equal(drafts.length, 1, 'skip today still continues the series');
  assert.equal(drafts[0]?.repeat, 'Daily');
}

{
  const onlySkip = task({ status: 'Cancelled' });
  const template = pickSeriesTemplate([onlySkip]);
  assert.equal(template?.repeat, 'Daily', 'skip on the only row still continues');
  const tomorrow = new Date(2026, 7, 25);
  assert.equal(ensureOccurrencesForDay([onlySkip], tomorrow).length, 1);
}

{
  const completedYesterday = task({
    id: 'yesterday',
    status: 'Completed',
    occurrenceDate: '2026-08-23',
    completedAt: '2026-08-23T18:00:00.000Z',
  });
  const patched = applySeriesPatch(
    [completedYesterday, today],
    completedYesterday,
    { repeat: 'None' },
    'future'
  );
  assert.equal(patched.find((row) => row.id === 'today')?.status, 'Cancelled');
  assert.equal(patched.find((row) => row.id === 'yesterday')?.status, 'Completed');
  assert.equal(pickSeriesTemplate(patched), null, 'stop from a completed day does not resurrect Daily history');
  assert.equal(ensureOccurrencesForDay(patched, new Date(2026, 7, 25)).length, 0);
}

{
  const expiredLater = task({
    id: 'expired',
    occurrenceDate: '2026-08-25',
    status: 'Expired',
  });
  const patched = applySeriesPatch([today, expiredLater], today, { repeat: 'None' }, 'future');
  assert.equal(patched.find((row) => row.id === 'expired')?.status, 'Expired', 'do not rewrite expired history');
}

{
  const legacyYesterday = task({
    id: 'legacy-y',
    definitionId: undefined,
    occurrenceDate: '2026-08-23',
    status: 'Completed',
  });
  const legacyToday = task({
    id: 'legacy-t',
    definitionId: undefined,
    occurrenceDate: '2026-08-24',
  });
  const patched = applySeriesPatch(
    [legacyYesterday, legacyToday],
    legacyToday,
    { title: 'Kitchen' },
    'future'
  );
  const nextY = patched.find((row) => row.id === 'legacy-y');
  const nextT = patched.find((row) => row.id === 'legacy-t');
  assert.ok(nextY?.definitionId);
  assert.equal(nextY?.definitionId, nextT?.definitionId, 'title change stamps the whole series');
  assert.equal(nextY?.title, 'Dishes', 'history title stays');
  assert.equal(nextT?.title, 'Kitchen');
  const drafts = ensureOccurrencesForDay(patched, new Date(2026, 7, 25));
  assert.equal(drafts.length, 1, 'one series after rename');
  assert.equal(drafts[0]?.title, 'Kitchen');
}

{
  const a = task({ repeat: 'Weekly' });
  const b = task({ id: 'other', repeat: 'Daily', occurrenceDate: '2026-08-23' });
  assert.equal(seriesDefinitionId(a), seriesDefinitionId(b));
  assert.equal(isSameTaskSeries(a, b), true, 'id beats current repeat');
}

console.log('PASS series-edit from-now-on regularity');
