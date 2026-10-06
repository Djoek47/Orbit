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
  assert.match(settings, /House ownership/);
  assert.doesNotMatch(
    settings,
    /subtitle="Transfer ownership · delete"/,
    'transfer/delete stay nested under You, not a main House hub'
  );

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
  assert.match(migration, /extensions\.gen_random_bytes/);
  assert.doesNotMatch(migration, /encode\(gen_random_bytes\(/);

  const fixMig = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20261006062055_fix_gen_random_bytes_and_security_advisors.sql'
    ),
    'utf8'
  );
  assert.match(fixMig, /extensions\.gen_random_bytes/);
  assert.match(fixMig, /revoke all on function/);
  assert.match(fixMig, /monitor_cron_cursor_service/);

  const edge = readFileSync(
    join(process.cwd(), 'supabase/functions/transfer-household/index.ts'),
    'utf8'
  );
  assert.match(edge, /action === 'create'/);
  assert.match(edge, /action === 'accept'/);
  assert.match(edge, /not_empty/);
  assert.match(edge, /mapCreateError/);

  const send = readFileSync(join(process.cwd(), 'lib/household/send-household-transfer.ts'), 'utf8');
  assert.match(send, /edgeErrorMessage/);
  assert.match(send, /friendlyTransferError/);

  const transferUi = readFileSync(join(process.cwd(), 'app/transfer-household.tsx'), 'utf8');
  assert.match(transferUi, /showNativeAppError/);
});

test('Pass mock multipass: create → parse → accept ownership swap', async () => {
  const {
    __clearMockTransferTokensForTests,
    __expireMockTransferTokenForTests,
    acceptHouseholdTransfer,
    createHouseholdTransferToken,
  } = await import('@/lib/household/send-household-transfer');
  __clearMockTransferTokensForTests();

  const created = await createHouseholdTransferToken({
    householdId: 'hh-nero',
    householdName: 'The Nero Home',
    userId: 'owner-1',
    mock: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.match(created.token, /^xfer-/);
  assert.equal(parseHouseholdTransferTokenFromUrl(created.shareLink), created.token);

  let swappedTo: string | null = null;
  const accepted = await acceptHouseholdTransfer({
    token: created.token,
    userId: 'empty-2',
    memberships: [],
    mock: true,
    onMockAccept: async (householdId) => {
      swappedTo = householdId;
    },
  });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.householdId, 'hh-nero');
  assert.equal(swappedTo, 'hh-nero');

  const reused = await acceptHouseholdTransfer({
    token: created.token,
    userId: 'empty-3',
    memberships: [],
    mock: true,
  });
  assert.equal(reused.ok, false);
  if (reused.ok) return;
  assert.equal(reused.code, 'used');

  const second = await createHouseholdTransferToken({
    householdId: 'hh-nero',
    householdName: 'The Nero Home',
    userId: 'owner-1',
    mock: true,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;

  const self = await acceptHouseholdTransfer({
    token: second.token,
    userId: 'owner-1',
    memberships: [],
    mock: true,
  });
  assert.equal(self.ok, false);

  const blocked = await acceptHouseholdTransfer({
    token: second.token,
    userId: 'busy-4',
    memberships: [
      {
        householdId: 'hh-other',
        householdName: 'Other',
        role: 'owner',
        status: 'active',
      },
    ],
    mock: true,
  });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.code, 'not_empty');

  const recoveryOk = await acceptHouseholdTransfer({
    token: second.token,
    userId: 'recover-5',
    memberships: [
      {
        householdId: 'hh-old',
        householdName: 'Old',
        role: 'owner',
        status: 'active',
        deletionScheduledFor: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
    mock: true,
  });
  assert.equal(recoveryOk.ok, true);

  const third = await createHouseholdTransferToken({
    householdId: 'hh-nero',
    householdName: 'The Nero Home',
    userId: 'owner-1',
    mock: true,
  });
  assert.equal(third.ok, true);
  if (!third.ok) return;
  __expireMockTransferTokenForTests(third.token);
  const expired = await acceptHouseholdTransfer({
    token: third.token,
    userId: 'empty-6',
    memberships: [],
    mock: true,
  });
  assert.equal(expired.ok, false);
  if (expired.ok) return;
  assert.equal(expired.code, 'expired');
});

test('friendlyTransferError hides gen_random_bytes raw text', async () => {
  const { friendlyTransferError } = await import('@/lib/supabase/edge-error');
  assert.match(
    friendlyTransferError('function gen_random_bytes(integer) does not exist'),
    /isn’t available|isn't available|after an update/i
  );
  assert.doesNotMatch(
    friendlyTransferError('function gen_random_bytes(integer) does not exist'),
    /gen_random_bytes/
  );
});
