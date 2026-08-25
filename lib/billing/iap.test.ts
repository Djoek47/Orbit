import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearMockEntitlement,
  IAP_PRODUCTS,
  isPremiumActive,
  startMockTrial,
} from '@/constants/billing';
import {
  clearEntitlementForTests,
  isNativeIapAvailable,
  premiumCopy,
  purchasePremium,
} from '@/lib/billing/iap';
import { premiumOnboardingHref } from '@/lib/billing/premium-onboarding';

test('A3 IAP catalog locks monthly pricing + trial', () => {
  assert.equal(IAP_PRODUCTS.monthly.priceUsd, 4.99);
  assert.equal(IAP_PRODUCTS.monthly.trialDays, 7);
  assert.equal(IAP_PRODUCTS.monthly.productId, 'app.choremaxx.household.premium.monthly');
  assert.equal(IAP_PRODUCTS.yearly.priceUsd, 48);
});

test('A3 mock trial activates entitlement', async () => {
  await clearEntitlementForTests();
  clearMockEntitlement();
  const state = await purchasePremium('monthly');
  assert.equal(state.active, true);
  assert.equal(state.inTrial, true);
  assert.equal(state.productId, IAP_PRODUCTS.monthly.productId);
  assert.equal(isPremiumActive(state), true);
  assert.match(premiumCopy(state), /trial/i);
  await clearEntitlementForTests();
});

test('A3 startMockTrial monthly', () => {
  clearMockEntitlement();
  const state = startMockTrial('monthly');
  assert.equal(state.productId, IAP_PRODUCTS.monthly.productId);
  clearMockEntitlement();
});

test('premium onboarding href defaults to onboarding source', () => {
  const href = premiumOnboardingHref();
  assert.equal(href.pathname, '/premium');
  assert.equal(href.params.source, 'onboarding');
});

test('native IAP is unavailable in this Node/unit environment', () => {
  assert.equal(isNativeIapAvailable(), false);
});
