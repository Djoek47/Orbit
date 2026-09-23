/**
 * Run: npx --yes tsx lib/billing/token-grants.test.ts
 */
import assert from 'node:assert/strict';

import { IAP_CONSUMABLES, IAP_PRODUCTS } from '@/constants/billing';
import {
  applyTopUpConsumption,
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

console.log('PASS token-grants');
