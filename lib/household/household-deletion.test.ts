import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOUSEHOLD_DELETION_GRACE_DAYS,
  householdDeletionDaysRemaining,
  isHouseholdDeletionPending,
  scheduleHouseholdDeletionDate,
} from '@/lib/household/household-deletion';

test('scheduleHouseholdDeletionDate adds 15 days', () => {
  const from = new Date('2026-01-01T12:00:00.000Z');
  const scheduled = scheduleHouseholdDeletionDate(from);
  assert.equal(new Date(scheduled).toISOString(), '2026-01-16T12:00:00.000Z');
  assert.equal(HOUSEHOLD_DELETION_GRACE_DAYS, 15);
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
