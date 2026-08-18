/**
 * Revision F §1 gate tests — `npx tsx lib/tasks/revision-f.test.ts`
 */
import assert from 'node:assert/strict';

import {
  assertUniqueOccurrenceInsert,
  dedupeOccurrences,
} from '@/lib/tasks/occurrence-dedupe';
import {
  ensureOccurrencesForDay,
  isExpiredStatus,
  rolloverMissedOccurrences,
  spawnNextOccurrence,
} from '@/lib/tasks/recurring';
import { expireOpenTasksAtBoundary } from '@/lib/tasks/expire-at-boundary';
import type { HouseholdTask } from '@/types/orbit';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

function base(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  return {
    id: 't1',
    title: 'Load the dishwasher',
    category: 'kitchen_dining',
    assignee: 'Maya',
    due: 'Today',
    xp: 10,
    repeat: 'Daily',
    status: 'Pending',
    definitionId: 'series:load_dishwasher',
    occurrenceDate: '2026-08-09',
    ...overrides,
  };
}

/** In-memory upsert … on conflict do nothing (mirrors taskRepository.upsertOccurrence). */
function upsertOccurrence(
  store: HouseholdTask[],
  draft: HouseholdTask
): { store: HouseholdTask[]; inserted: boolean; task: HouseholdTask } {
  const existing = store.find(
    (t) => t.definitionId === draft.definitionId && t.occurrenceDate === draft.occurrenceDate
  );
  if (existing) return { store, inserted: false, task: existing };
  assertUniqueOccurrenceInsert(store, draft);
  return { store: [draft, ...store], inserted: true, task: draft };
}

// --- F1.1 Unique constraint (in-memory index) ---
{
  const existing = [base({ id: 'kept' })];
  assert.throws(
    () =>
      assertUniqueOccurrenceInsert(existing, {
        id: 'dup',
        definitionId: 'series:load_dishwasher',
        occurrenceDate: '2026-08-09',
      }),
    /UNIQUE_VIOLATION/
  );
  pass('F1.1', 'Double-insert rejected by unique occurrence guard');
}

// --- F1.2 Complete daily 4× → still one occurrence row for that day ---
{
  let store: HouseholdTask[] = [
    base({
      id: 'def',
      status: 'Completed',
      occurrenceDate: '2026-08-08',
      completedAt: '2026-08-08T18:00:00.000Z',
    }),
  ];
  const day = new Date(2026, 7, 9); // Aug 9
  const drafts = ensureOccurrencesForDay(store, day);
  assert.equal(drafts.length, 1, 'one draft');
  const draft: HouseholdTask = {
    ...drafts[0],
    id: 'occ-aug9',
  };
  let first = upsertOccurrence(store, draft);
  store = first.store;
  assert.equal(first.inserted, true);
  for (let i = 0; i < 3; i += 1) {
    const again = upsertOccurrence(store, { ...draft, id: `dup-${i}` });
    store = again.store;
    assert.equal(again.inserted, false, `upsert ${i} is no-op`);
    assert.equal(again.task.id, first.task.id);
  }
  const forDay = store.filter(
    (t) => t.definitionId === draft.definitionId && t.occurrenceDate === draft.occurrenceDate
  );
  assert.equal(forDay.length, 1, 'exactly one row for the day');
  assert.equal(spawnNextOccurrence(first.task), null, 'completion never spawns');
  // Completing four times must not create a next occurrence.
  for (let i = 0; i < 4; i += 1) {
    assert.equal(spawnNextOccurrence({ ...first.task, status: 'Completed' }), null);
  }
  pass('F1.2', 'Four upserts leave ONE occurrence row; complete does not spawn');
}

// --- F1.3 Rollover twice → identical state ---
{
  const seed = [
    base({ id: 'a', status: 'Pending', occurrenceDate: '2026-08-09', due: 'Yesterday' }),
    base({
      id: 'b',
      title: 'Dry and put away dishes',
      definitionId: 'series:dry',
      status: 'Pending',
      occurrenceDate: '2026-08-09',
      due: 'Yesterday',
    }),
  ];
  const now = new Date(2026, 7, 10, 8, 0, 0);
  const once = rolloverMissedOccurrences(seed, '2026-08-09', now);
  const twice = rolloverMissedOccurrences(once, '2026-08-09', now);
  assert.equal(once.length, twice.length);
  for (let i = 0; i < once.length; i += 1) {
    assert.equal(once[i].status, 'Expired');
    assert.equal(twice[i].status, once[i].status);
    assert.equal(twice[i].expiredAt, once[i].expiredAt);
    assert.ok(isExpiredStatus(once[i].status));
  }
  pass('F1.3', 'Rollover is idempotent; status is Expired');
}

// --- F1.4 Cleanup reduces 3× duplicates to 1 ---
{
  const triples = [
    base({
      id: 'c1',
      status: 'Completed',
      awardedXp: 10,
      completedAt: '2026-08-09T12:00:00.000Z',
    }),
    base({ id: 'c2', status: 'Pending' }),
    base({ id: 'c3', status: 'Pending' }),
    base({
      id: 'd1',
      title: 'Dry and put away dishes',
      definitionId: 'series:dry',
      status: 'Pending',
    }),
    base({
      id: 'd2',
      title: 'Dry and put away dishes',
      definitionId: 'series:dry',
      status: 'Pending',
    }),
    base({
      id: 'd3',
      title: 'Dry and put away dishes',
      definitionId: 'series:dry',
      status: 'Pending',
    }),
  ];
  const report = dedupeOccurrences(triples);
  assert.equal(report.deletedCount, 4, '4 duplicates removed');
  assert.equal(report.kept.length, 2, '2 series remain');
  const load = report.kept.find((t) => t.definitionId === 'series:load_dishwasher');
  assert.equal(load?.id, 'c1', 'keeps completed row');
  assert.equal(report.xpReconciled, 0, 'no over-award when only one completed');
  pass('F1.4', 'Cleanup reduces 3× duplicates to 1 per series');
}

// --- F1.5 Counter uses true unique count ---
{
  const padded = [
    base({ id: '1', status: 'Completed', awardedXp: 10 }),
    base({ id: '2', status: 'Pending' }),
    base({ id: '3', status: 'Pending' }),
    base({
      id: '4',
      title: 'Wipe counters',
      definitionId: 'series:wipe',
      status: 'Completed',
      awardedXp: 10,
    }),
  ];
  const { kept } = dedupeOccurrences(padded);
  const done = kept.filter((t) => t.status === 'Completed').length;
  const total = kept.length;
  assert.equal(`${done} of ${total} complete`, '2 of 2 complete');
  pass('F1.5', 'Task counter reads true count after dedupe');
}

// --- House Rules v4: expire at 23:59 same day, skip recess ---
{
  const pending = base({
    id: 'same-day',
    status: 'Pending',
    occurrenceDate: '2026-08-18',
    due: 'Today',
    dueAt: new Date(2026, 7, 18, 19, 0, 0).toISOString(),
  });
  const before = expireOpenTasksAtBoundary([pending], new Date(2026, 7, 18, 23, 59, 0), {
    expiryHm: '23:59',
  });
  assert.equal(before[0].status, 'Pending', 'still open at 23:59:00');
  const justAfter = expireOpenTasksAtBoundary([pending], new Date(2026, 7, 19, 0, 0, 0), {
    expiryHm: '23:59',
  });
  assert.equal(justAfter[0].status, 'Expired', 'DEAD-04 expires after 23:59');

  const recessHeld = expireOpenTasksAtBoundary([pending], new Date(2026, 7, 19, 8, 0, 0), {
    expiryHm: '23:59',
    assigneeOnRecess: (name, dateKey) => name === 'Maya' && dateKey === '2026-08-18',
  });
  assert.equal(recessHeld[0].status, 'Pending', 'STRK-04 recess skips expiry');

  const drafts = ensureOccurrencesForDay(
    [base({ status: 'Completed', occurrenceDate: '2026-08-17' })],
    new Date(2026, 7, 18),
    '19:00',
    { skipAssignees: ['Maya'] }
  );
  assert.equal(drafts.length, 0, 'recess skips occurrence spawn');
  pass('F1.6', 'Same-day expiry at 23:59; recess skips expire + spawn');
}

console.log('test:revision-f OK');
