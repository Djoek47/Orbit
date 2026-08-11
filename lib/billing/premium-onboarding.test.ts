import assert from 'node:assert/strict';
import test from 'node:test';

import { IAP_PRODUCTS } from '@/constants/billing';
import { premiumOnboardingHref } from '@/lib/billing/premium-onboarding';
import { purchasePremium, premiumCopy } from '@/lib/billing/iap';
import { clearMockEntitlement } from '@/constants/billing';

test('premium onboarding href defaults to onboarding source', () => {
  const href = premiumOnboardingHref();
  assert.equal(href.pathname, '/premium');
  assert.equal(href.params.source, 'onboarding');
});

test('onboarding trial is monthly $4.99 with 7-day trial', async () => {
  clearMockEntitlement();
  const state = await purchasePremium('monthly');
  assert.equal(IAP_PRODUCTS.monthly.priceUsd, 4.99);
  assert.equal(IAP_PRODUCTS.monthly.trialDays, 7);
  assert.equal(state.inTrial, true);
  assert.equal(state.productId, IAP_PRODUCTS.monthly.productId);
  assert.match(premiumCopy(state), /trial/i);
  clearMockEntitlement();
});
