import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('delete household copy references 30-day policy and admin access', () => {
  const src = readFileSync(join(process.cwd(), 'app/delete-household.tsx'), 'utf8');
  assert.match(src, /HOUSEHOLD_DELETION_POLICY_COPY/);
  assert.match(src, /canManageHouseholdDeletion/);
  assert.match(src, /requestImmediateHouseholdDeletion/);
  assert.match(src, /Delete sooner/);
});

test('settings banner allows admin undo and mentions reminder ladder', () => {
  const src = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  assert.match(src, /Reminder emails start in the final week/);
  assert.match(src, /currentMember\?\.role === 'admin'/);
});

test('migration sets 30-day grace and admin RPCs', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/migrations/20261005140000_household_deletion_v2.sql'),
    'utf8'
  );
  assert.match(src, /interval '30 days'/);
  assert.match(src, /is_household_admin/);
  assert.match(src, /request_immediate_household_deletion/);
  assert.match(src, /opt_out_household_deletion_reminders/);
  assert.match(src, /purge_due_households/);
});

test('deletion cron edge walks reminder ladder', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/functions/household-deletion-cron/index.ts'),
    'utf8'
  );
  assert.match(src, /DELETION_REMINDER_STAGING/);
  assert.match(src, /1h11m/);
  assert.match(src, /purge_due_households/);
  assert.match(src, /renderHouseholdDeletionEmail/);
});
