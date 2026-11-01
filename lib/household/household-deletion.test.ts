import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canManageHouseholdDeletion,
  DELETION_REMINDER_STAGING_THRESHOLDS_MS,
  DELETION_REMINDER_THRESHOLDS_MS,
  HOUSEHOLD_DELETION_GRACE_DAYS,
  householdDeletionDaysRemaining,
  isHouseholdDeletionPending,
  nextDeletionReminderStage,
  scheduleHouseholdDeletionDate,
  scheduleImmediateDeletionConfirmDate,
  IMMEDIATE_DELETION_CONFIRM_HOURS,
} from '@/lib/household/household-deletion';

test('scheduleHouseholdDeletionDate adds 30 days', () => {
  const from = new Date('2026-01-01T12:00:00.000Z');
  const scheduled = scheduleHouseholdDeletionDate(from);
  assert.equal(new Date(scheduled).toISOString(), '2026-01-31T12:00:00.000Z');
  assert.equal(HOUSEHOLD_DELETION_GRACE_DAYS, 30);
});

test('scheduleImmediateDeletionConfirmDate adds 24 hours', () => {
  const from = new Date('2026-01-01T12:00:00.000Z');
  const scheduled = scheduleImmediateDeletionConfirmDate(from);
  assert.equal(
    new Date(scheduled).toISOString(),
    '2026-01-02T12:00:00.000Z'
  );
  assert.equal(IMMEDIATE_DELETION_CONFIRM_HOURS, 24);
});

test('isHouseholdDeletionPending is true before scheduled date', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isHouseholdDeletionPending({ deletionScheduledFor: future }), true);
});

test('isHouseholdDeletionPending is false when past', () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isHouseholdDeletionPending({ deletionScheduledFor: past }), false);
});

test('householdDeletionDaysRemaining rounds up', () => {
  const inTwoDays = new Date(Date.now() + 2.2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(householdDeletionDaysRemaining(inTwoDays), 3);
});

test('reminders stay silent until final 7 days', () => {
  const now = new Date('2026-03-01T12:00:00.000Z');
  const purge = new Date('2026-03-20T12:00:00.000Z').toISOString(); // 19d left
  assert.equal(nextDeletionReminderStage(purge, null, now), null);
});

test('ladder fires 7d → 3d → 24h → 1h11m in order', () => {
  const purge = new Date('2026-04-10T12:00:00.000Z').toISOString();

  assert.equal(
    nextDeletionReminderStage(purge, null, new Date('2026-04-03T12:00:00.000Z')),
    '7d'
  );
  assert.equal(
    nextDeletionReminderStage(purge, '7d', new Date('2026-04-05T12:00:00.000Z')),
    null
  );
  assert.equal(
    nextDeletionReminderStage(purge, '7d', new Date('2026-04-07T12:00:00.000Z')),
    '3d'
  );
  assert.equal(
    nextDeletionReminderStage(purge, '3d', new Date('2026-04-09T12:00:00.000Z')),
    '24h'
  );
  assert.equal(
    nextDeletionReminderStage(
      purge,
      '24h',
      new Date('2026-04-10T10:50:00.000Z')
    ),
    '1h11m'
  );
  assert.equal(
    nextDeletionReminderStage(
      purge,
      '1h11m',
      new Date('2026-04-10T11:00:00.000Z')
    ),
    null
  );
});

test('late cron still walks earlier unsent stages first', () => {
  const purge = new Date('2026-04-10T12:00:00.000Z').toISOString();
  // 2 days left, nothing sent yet → 7d first (threshold crossed)
  assert.equal(
    nextDeletionReminderStage(purge, null, new Date('2026-04-08T12:00:00.000Z')),
    '7d'
  );
  assert.equal(
    nextDeletionReminderStage(purge, '7d', new Date('2026-04-08T12:00:00.000Z')),
    '3d'
  );
});

test('staging thresholds compress the ladder', () => {
  const now = new Date('2026-05-01T12:00:00.000Z');
  const purge = new Date(now.getTime() + 2.5 * 60 * 1000).toISOString(); // 2.5 min left
  assert.equal(
    nextDeletionReminderStage(purge, null, now, DELETION_REMINDER_STAGING_THRESHOLDS_MS),
    '7d'
  );
  assert.equal(
    nextDeletionReminderStage(purge, '7d', now, DELETION_REMINDER_STAGING_THRESHOLDS_MS),
    '3d'
  );
});

test('production 7d threshold matches window constant', () => {
  assert.equal(DELETION_REMINDER_THRESHOLDS_MS['7d'], 7 * 24 * 60 * 60 * 1000);
});

test('owner and admin can manage deletion', () => {
  assert.equal(canManageHouseholdDeletion('owner'), true);
  assert.equal(canManageHouseholdDeletion('admin'), true);
  assert.equal(canManageHouseholdDeletion('adult'), false);
  assert.equal(canManageHouseholdDeletion('child'), false);
});
