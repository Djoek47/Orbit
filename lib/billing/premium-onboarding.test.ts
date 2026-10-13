import assert from 'node:assert/strict';
import test from 'node:test';

import { IAP_PRODUCTS } from '@/constants/billing';
import { clearMockEntitlement } from '@/constants/billing';
import { premiumCopy, purchasePremium } from '@/lib/billing/iap';
import {
  __resetPremiumOnboardingNavLockForTests,
  goPremiumOnboardingOnce,
  premiumOnboardingHref,
} from '@/lib/billing/premium-onboarding';

test('premium onboarding href defaults to onboarding source', () => {
  const href = premiumOnboardingHref();
  assert.equal(href.pathname, '/premium');
  assert.equal(href.params.source, 'onboarding');
});

test('goPremiumOnboardingOnce only navigates once', async () => {
  __resetPremiumOnboardingNavLockForTests();
  let hits = 0;
  assert.equal(
    await goPremiumOnboardingOnce(() => {
      hits += 1;
    }),
    true
  );
  assert.equal(
    await goPremiumOnboardingOnce(() => {
      hits += 1;
    }),
    false
  );
  assert.equal(hits, 1);
  __resetPremiumOnboardingNavLockForTests();
});

test('onboarding trial is yearly-led $49.99 / monthly $6.99 with 7-day trial', async () => {
  clearMockEntitlement();
  const state = await purchasePremium('yearly');
  assert.equal(IAP_PRODUCTS.monthly.priceUsd, 6.99);
  assert.equal(IAP_PRODUCTS.yearly.priceUsd, 49.99);
  assert.equal(IAP_PRODUCTS.monthly.trialDays, 7);
  assert.equal(state.inTrial, true);
  assert.equal(state.productId, IAP_PRODUCTS.yearly.productId);
  assert.match(premiumCopy(state), /trial/i);
  clearMockEntitlement();
});
