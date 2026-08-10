import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearMockEntitlement,
  IAP_PRODUCTS,
  isPremiumActive,
  startMockTrial,
} from '@/constants/billing';
import { premiumCopy, purchasePremium } from '@/lib/billing/iap';

test('A3 IAP catalog locks pricing', () => {
  assert.equal(IAP_PRODUCTS.monthly.priceUsd, 4.99);
  assert.equal(IAP_PRODUCTS.yearly.priceUsd, 48);
  assert.equal(IAP_PRODUCTS.monthly.trialDays, 7);
});

test('A3 mock trial activates entitlement', async () => {
  clearMockEntitlement();
  const state = await purchasePremium('yearly');
  assert.equal(state.active, true);
  assert.equal(state.inTrial, true);
  assert.equal(state.productId, IAP_PRODUCTS.yearly.productId);
  assert.equal(isPremiumActive(state), true);
  assert.match(premiumCopy(state), /trial/i);
  clearMockEntitlement();
});

test('A3 startMockTrial monthly', () => {
  clearMockEntitlement();
  const state = startMockTrial('monthly');
  assert.equal(state.productId, IAP_PRODUCTS.monthly.productId);
  clearMockEntitlement();
});
