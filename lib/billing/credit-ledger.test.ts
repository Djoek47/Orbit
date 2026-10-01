import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatResetDate,
  nextAllowanceReset,
  spendsFrom,
  summarizeCredits,
} from '@/lib/billing/credit-ledger';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import type { TokenGrantBalance } from '@/lib/billing/token-grants-math';

const grant = (id: string, tokens: number, consumed: number, at: string): TokenGrantBalance => ({
  id,
  householdId: 'hh',
  pack: `${tokens} actions`,
  tokens,
  consumed,
  transactionId: `t-${id}`,
  grantedAt: at,
});

// Nothing bought: the month's allowance is all there is.
const empty = summarizeCredits([], 40);
assert.equal(empty.balance, 0);
assert.equal(empty.monthlyLeft, TOKENS_PER_MONTH - 40);
assert.equal(empty.totalAvailable, TOKENS_PER_MONTH - 40);
assert.equal(spendsFrom(empty), 'allowance');

// Credits bank up across months and are never written off.
const grants = [
  grant('a', 600, 600, '2026-07-02T10:00:00Z'),
  grant('b', 600, 150, '2026-08-11T10:00:00Z'),
  grant('c', 1500, 0, '2026-09-20T10:00:00Z'),
];
const s = summarizeCredits(grants, TOKENS_PER_MONTH);
assert.equal(s.lifetimePurchased, 2700);
assert.equal(s.lifetimeSpent, 750);
assert.equal(s.balance, 1950, 'everything unspent stays, however old');
assert.equal(s.monthlyLeft, 0, 'the allowance is gone this month');
assert.equal(s.totalAvailable, 1950, 'but the credits are still there');
assert.equal(spendsFrom(s), 'credits', 'the allowance pays first, then credits');

// Newest purchase first, and each row balances.
assert.deepEqual(s.rows.map((r) => r.id), ['c', 'b', 'a']);
for (const row of s.rows) assert.equal(row.granted - row.spent, row.left);

// Over-spending the allowance never makes it negative.
assert.equal(summarizeCredits([], TOKENS_PER_MONTH + 99).monthlyLeft, 0);

// A fully spent pack keeps its history but adds nothing.
assert.equal(summarizeCredits([grant('a', 600, 600, '2026-07-02T10:00:00Z')], 0).balance, 0);

// The reset is the 1st of next month — credits don't care.
const dec = new Date(2026, 11, 14);
assert.equal(nextAllowanceReset(dec).getFullYear(), 2027);
assert.equal(nextAllowanceReset(dec).getMonth(), 0, 'January');
assert.equal(nextAllowanceReset(dec).getDate(), 1);
assert.match(formatResetDate(new Date(2026, 8, 30)), /Oct 1/);

// The rule lives in the database too, not just here.
{
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260930220000_credits_never_expire.sql'),
    'utf8'
  );
  assert.match(sql, /consumed <= tokens/, 'a balance can never go negative');
  assert.match(sql, /household_credit_balance/, 'and there is one place to read it');
  assert.doesNotMatch(sql, /expires_at|expires on/i, 'nothing expires credits');
}

// The two screens are separate, and each says which pot it is about.
{
  const actions = readFileSync(join(process.cwd(), 'app/poppins-actions.tsx'), 'utf8');
  const credits = readFileSync(join(process.cwd(), 'app/poppins-credits.tsx'), 'utf8');
  assert.match(actions, /CreditBreakdownView/, 'Actions shows where the month went');
  assert.doesNotMatch(actions, /grantTokenPack/, 'and never sells anything');
  assert.match(credits, /CREDIT BALANCE/, 'Credits leads with the balance');
  assert.match(credits, /never expire/, 'and says they keep');
  assert.doesNotMatch(credits, /CreditBreakdownView/, 'without the usage chart');
  const panel = readFileSync(
    join(process.cwd(), 'components/orbit/poppins/poppins-settings-panel.tsx'),
    'utf8'
  );
  assert.match(panel, /label="Actions"/);
  assert.match(panel, /label="Credits"/);
  assert.doesNotMatch(panel, /Actions & credits/, 'the one combined row is gone');
}

console.log('credit-ledger: ok');
