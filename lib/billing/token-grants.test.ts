/**
 * Run: npx --yes tsx lib/billing/token-grants.test.ts
 */
import assert from 'node:assert/strict';

import { IAP_CONSUMABLES, IAP_PRODUCTS } from '@/constants/billing';
import { summarizeCredits } from '@/lib/billing/credit-ledger';
import {
  applyTopUpConsumption,
  mergeTokenGrants,
  topUpBalanceFromGrants,
  type TokenGrantBalance,
} from '@/lib/billing/token-grants-math';

assert.equal(IAP_PRODUCTS.monthly.priceUsd, 6.99);
assert.equal(IAP_CONSUMABLES.tokensSmall.tokens, 200);
assert.equal(IAP_CONSUMABLES.tokensMedium.tokens, 600);
assert.equal(IAP_CONSUMABLES.tokensLarge.tokens, 1500);
assert.equal(IAP_PRODUCTS.consumables.tokensSmall.productId, IAP_CONSUMABLES.tokensSmall.productId);

const grants: TokenGrantBalance[] = [
  {
    id: 'g1',
    householdId: 'hh',
    pack: 'small',
    tokens: 200,
    consumed: 180,
    transactionId: 't1',
    grantedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'g2',
    householdId: 'hh',
    pack: 'medium',
    tokens: 600,
    consumed: 0,
    transactionId: 't2',
    grantedAt: '2026-09-02T00:00:00.000Z',
  },
];

assert.equal(topUpBalanceFromGrants(grants), 620);
const { grants: after, consumed } = applyTopUpConsumption(grants, 50);
assert.equal(consumed, 50);
assert.equal(after[0]!.consumed, 200, 'oldest drained first');
assert.equal(after[1]!.consumed, 30);
assert.equal(topUpBalanceFromGrants(after), 570);

// New buys append — balance is old left + new pack, never a replace.
{
  const july: TokenGrantBalance = {
    id: 'mock-july',
    householdId: 'hh',
    pack: 'medium',
    tokens: 600,
    consumed: 100,
    transactionId: 'buy-july',
    grantedAt: '2026-07-15T12:00:00.000Z',
  };
  const august: TokenGrantBalance = {
    id: 'mock-aug',
    householdId: 'hh',
    pack: 'small',
    tokens: 200,
    consumed: 0,
    transactionId: 'buy-aug',
    grantedAt: '2026-08-20T12:00:00.000Z',
  };
  const banked = [july, august];
  assert.equal(topUpBalanceFromGrants(banked), 700, '500 left from July + 200 August');
  const september: TokenGrantBalance = {
    id: 'mock-sep',
    householdId: 'hh',
    pack: 'large',
    tokens: 1500,
    consumed: 0,
    transactionId: 'buy-sep',
    grantedAt: '2026-09-05T12:00:00.000Z',
  };
  const next = [...banked, september];
  assert.equal(topUpBalanceFromGrants(next), 2200, 'new buy adds on top of prior months');
  const summary = summarizeCredits(next, 300);
  assert.equal(summary.balance, 2200);
  assert.equal(summary.lifetimePurchased, 2300);
  assert.equal(summary.monthlyLeft, 0, 'allowance can be spent; credits still bank');
  assert.equal(summary.totalAvailable, 2200);
}

// Empty remote must not wipe local mock buys.
{
  const local: TokenGrantBalance[] = [
    {
      id: 'mock-txn-1',
      householdId: 'hh',
      pack: 'medium',
      tokens: 600,
      consumed: 0,
      transactionId: 'mock-txn-1',
      grantedAt: '2026-09-01T00:00:00.000Z',
    },
  ];
  const mergedEmptyRemote = mergeTokenGrants(local, []);
  assert.equal(mergedEmptyRemote.length, 1);
  assert.equal(topUpBalanceFromGrants(mergedEmptyRemote), 600);

  const remote: TokenGrantBalance[] = [
    {
      id: 'uuid-remote',
      householdId: 'hh',
      pack: 'small',
      tokens: 200,
      consumed: 50,
      transactionId: 'storekit-1',
      grantedAt: '2026-08-01T00:00:00.000Z',
    },
  ];
  const merged = mergeTokenGrants(local, remote);
  assert.equal(merged.length, 2);
  assert.equal(topUpBalanceFromGrants(merged), 750);
}

console.log('PASS token-grants');
