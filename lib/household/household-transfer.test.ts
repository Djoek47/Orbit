import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildHouseholdTransferDeepLink,
  canGenerateHouseholdTransfer,
  isEmptyAccountForTransfer,
  parseHouseholdTransferTokenFromUrl,
  transferTokenExpiresAt,
  HOUSEHOLD_TRANSFER_TTL_MS,
} from '@/lib/household/household-transfer';

test('empty account eligibility', () => {
  assert.equal(isEmptyAccountForTransfer([]), true);
  assert.equal(
    isEmptyAccountForTransfer([
      {
        householdId: 'h1',
        householdName: 'Live Home',
        role: 'owner',
        status: 'active',
      },
    ]),
    false
  );
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(
    isEmptyAccountForTransfer([
      {
        householdId: 'h2',
        householdName: 'Old Home',
        role: 'owner',
        status: 'active',
        deletionScheduledFor: future,
      },
    ]),
    true
  );
});

test('only named live owner can generate transfer QR', () => {
  assert.equal(
    canGenerateHouseholdTransfer({
      role: 'owner',
      householdName: 'The Nero Home',
    }),
    true
  );
  assert.equal(
    canGenerateHouseholdTransfer({
      role: 'admin',
      householdName: 'The Nero Home',
    }),
    false
  );
  assert.equal(
    canGenerateHouseholdTransfer({
      role: 'owner',
      householdName: 'The Nero Home',
      deletionScheduledFor: new Date(Date.now() + 86400000).toISOString(),
    }),
    false
  );
});

test('transfer deep link parse round-trip', () => {
  const token = 'abc123transferTOKEN';
  const link = buildHouseholdTransferDeepLink(token);
  assert.match(link, /orbit:\/\/transfer-household\?token=/);
  assert.equal(parseHouseholdTransferTokenFromUrl(link), token);
  assert.equal(
    parseHouseholdTransferTokenFromUrl(
      `https://www.choremaxx.app/transfer-household?token=${encodeURIComponent(token)}`
    ),
    token
  );
  assert.equal(
    parseHouseholdTransferTokenFromUrl(
      `choremaxx://transfer-household?token=${encodeURIComponent(token)}`
    ),
    token
  );
});

test('transfer TTL is 15 minutes', () => {
  assert.equal(HOUSEHOLD_TRANSFER_TTL_MS, 15 * 60 * 1000);
  const from = new Date('2026-07-01T12:00:00.000Z');
  assert.equal(transferTokenExpiresAt(from), '2026-07-01T12:15:00.000Z');
});

test('transfer UI and migration are wired', () => {
  const settings = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  assert.match(settings, /Transfer ownership/);
  assert.match(settings, /transfer-household/);

  const transfer = readFileSync(join(process.cwd(), 'app/transfer-household.tsx'), 'utf8');
  assert.match(transfer, /createHouseholdTransferToken/);
  assert.match(transfer, /15/);

  const accept = readFileSync(join(process.cwd(), 'app/accept-household-transfer.tsx'), 'utf8');
  assert.match(accept, /acceptHouseholdTransfer/);
  assert.match(accept, /emptyAccountTransferMessage|isEmptyAccountForTransfer/);

  const deep = readFileSync(join(process.cwd(), 'lib/hooks/use-deep-link-invite.ts'), 'utf8');
  assert.match(deep, /parseHouseholdTransferTokenFromUrl/);
  assert.match(deep, /accept-household-transfer/);

  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20261005150000_household_transfer.sql'),
    'utf8'
  );
  assert.match(migration, /create_household_transfer_token/);
  assert.match(migration, /accept_household_transfer/);
  assert.match(migration, /interval '15 minutes'/);
  assert.match(migration, /TRANSFER_NOT_EMPTY/);
  assert.match(migration, /role = 'adult'/);

  const edge = readFileSync(
    join(process.cwd(), 'supabase/functions/transfer-household/index.ts'),
    'utf8'
  );
  assert.match(edge, /action === 'create'/);
  assert.match(edge, /action === 'accept'/);
  assert.match(edge, /not_empty/);
});
