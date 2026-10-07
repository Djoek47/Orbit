/**
 * Unit tests for household-TZ expiry (DEAD-04).
 */
import assert from 'node:assert/strict';

import { expireOpenTasksAtBoundary } from '@/lib/tasks/expire-at-boundary';
import {
  expiryInstantInTimezone,
  formatDateInTimezone,
  isPastDailyDeadline,
  wallTimeToUtc,
} from '@/lib/tasks/household-tz';
import type { HouseholdTask } from '@/types/orbit';

function task(overrides: Partial<HouseholdTask> & Pick<HouseholdTask, 'id'>): HouseholdTask {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Chore',
    category: overrides.category ?? 'chores',
    assignee: overrides.assignee ?? 'Maya',
    due: overrides.due ?? 'Today',
    xp: overrides.xp ?? 10,
    repeat: overrides.repeat ?? 'None',
    status: overrides.status ?? 'Pending',
    occurrenceDate: overrides.occurrenceDate,
    dueAt: overrides.dueAt,
    expiredAt: overrides.expiredAt,
  };
}

{
  // 21:58 America/Toronto on Sep 20 = 01:58 UTC Sep 21 — must NOT expire yet.
  const now = wallTimeToUtc('2026-09-20', '21:58', 'America/Toronto');
  const pending = task({ id: 't1', occurrenceDate: '2026-09-20' });
  const next = expireOpenTasksAtBoundary([pending], now, {
    expiryHm: '23:59',
    timezone: 'America/Toronto',
  });
  assert.equal(next[0]?.status, 'Pending', 'Toronto evening before 23:59 stays Pending');
  assert.equal(formatDateInTimezone(now, 'America/Toronto'), '2026-09-20');
}

{
  const now = wallTimeToUtc('2026-09-20', '23:59', 'America/Toronto', {
    seconds: 59,
    ms: 500,
  });
  // Just after inclusive boundary (59.999) — bump past it
  const after = new Date(expiryInstantInTimezone('2026-09-20', '23:59', 'America/Toronto').getTime() + 1);
  const pending = task({ id: 't2', occurrenceDate: '2026-09-20' });
  const next = expireOpenTasksAtBoundary([pending], after, {
    expiryHm: '23:59',
    timezone: 'America/Toronto',
  });
  assert.equal(next[0]?.status, 'Expired', 'after household-local 23:59 → Expired');
}

{
  // Simulate Edge UTC runtime: same instant, UTC calendar day already rolled.
  const now = new Date('2026-09-21T01:58:00.000Z'); // 21:58 EDT
  const pending = task({ id: 't3', occurrenceDate: '2026-09-20' });
  const next = expireOpenTasksAtBoundary([pending], now, {
    expiryHm: '23:59',
    timezone: 'America/Toronto',
  });
  assert.equal(
    next[0]?.status,
    'Pending',
    'UTC runtime must not expire Toronto today chores at 21:58 local'
  );
}

{
  assert.equal(
    isPastDailyDeadline(wallTimeToUtc('2026-09-20', '21:00', 'America/Toronto'), '21:00', 'America/Toronto'),
    true
  );
  assert.equal(
    isPastDailyDeadline(wallTimeToUtc('2026-09-20', '20:59', 'America/Toronto'), '21:00', 'America/Toronto'),
    false
  );
}

console.log('test:household-tz-expiry OK');
