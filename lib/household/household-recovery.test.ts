import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canOpenHouseholdRecovery,
  deletionCountdownParts,
  isNamedHousehold,
  isRecoverableDeletionMembership,
  listRecoverableDeletions,
} from '@/lib/household/household-recovery';

test('brand-new empty accounts never list recoverable deletions', () => {
  assert.deepEqual(listRecoverableDeletions([]), []);
});

test('unnamed shells are not recoverable', () => {
  assert.equal(isNamedHousehold(''), false);
  assert.equal(isNamedHousehold('Household'), false);
  assert.equal(isNamedHousehold('The Nero Home'), true);
});

test('only owner/admin with pending purge can recover', () => {
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(
    isRecoverableDeletionMembership({
      householdId: 'h1',
      householdName: 'The Nero Home',
      role: 'owner',
      deletionScheduledFor: future,
    }),
    true
  );
  assert.equal(
    isRecoverableDeletionMembership({
      householdId: 'h1',
      householdName: 'The Nero Home',
      role: 'adult',
      deletionScheduledFor: future,
    }),
    false
  );
  assert.equal(
    canOpenHouseholdRecovery({
      role: 'admin',
      householdName: 'Rivera',
      deletionScheduledFor: future,
      hasMembershipHistory: true,
    }),
    true
  );
  assert.equal(
    canOpenHouseholdRecovery({
      role: 'owner',
      householdName: 'Rivera',
      deletionScheduledFor: future,
      hasMembershipHistory: false,
    }),
    false
  );
});

test('countdown parts match remaining time', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const purge = new Date('2026-06-03T15:30:45.000Z').toISOString();
  const parts = deletionCountdownParts(purge, now);
  assert.equal(parts.days, 2);
  assert.equal(parts.hours, 3);
  assert.equal(parts.minutes, 30);
  assert.equal(parts.seconds, 45);
  assert.match(parts.label, /2d 03h 30m 45s/);
});

test('recovery screen and hourglass are wired', () => {
  const screen = readFileSync(join(process.cwd(), 'app/household-recovery.tsx'), 'utf8');
  assert.match(screen, /HouseholdRecoveryHourglass/);
  assert.match(screen, /Cancel deletion/);
  assert.match(screen, /Delete permanently now/);
  assert.match(screen, /Stop reminder emails/);
  assert.match(screen, /canOpenHouseholdRecovery/);

  const hourglass = readFileSync(
    join(process.cwd(), 'components/orbit/household-recovery-hourglass.tsx'),
    'utf8'
  );
  assert.match(hourglass, /PoppinsHourglass/);
  assert.match(hourglass, /deletionCountdownParts/);
  assert.match(hourglass, /breathe/);

  const layout = readFileSync(join(process.cwd(), 'app/_layout.tsx'), 'utf8');
  assert.match(layout, /household-recovery/);

  const settings = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  assert.match(settings, /household-recovery/);

  const welcome = readFileSync(join(process.cwd(), 'app/welcome.tsx'), 'utf8');
  assert.match(welcome, /listRecoverableDeletions/);
  assert.match(welcome, /Recover /);
});
