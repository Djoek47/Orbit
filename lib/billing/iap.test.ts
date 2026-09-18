import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearMockEntitlement,
  IAP_CONSUMABLES,
  IAP_PRODUCTS,
  isPremiumActive,
  startMockTrial,
} from '@/constants/billing';
import {
  clearEntitlementForTests,
  isNativeIapAvailable,
  premiumCopy,
  purchasePremium,
  purchaseTokens,
} from '@/lib/billing/iap';
import { premiumOnboardingHref } from '@/lib/billing/premium-onboarding';
import { applyTopUpConsumption, topUpBalanceFromGrants } from '@/lib/billing/token-grants-math';

test('IAP catalog locks monthly/yearly pricing + trial', () => {
  assert.equal(IAP_PRODUCTS.monthly.priceUsd, 6.99);
  assert.equal(IAP_PRODUCTS.monthly.trialDays, 7);
  assert.equal(IAP_PRODUCTS.monthly.productId, 'app.choremaxx.household.premium.monthly');
  assert.equal(IAP_PRODUCTS.yearly.priceUsd, 49.99);
  assert.equal(IAP_PRODUCTS.yearly.savingsLabel, '40% off');
});

test('consumable token packs are catalogued', () => {
  assert.equal(IAP_CONSUMABLES.tokensSmall.tokens, 200);
  assert.equal(IAP_CONSUMABLES.tokensMedium.priceUsd, 4.99);
  assert.equal(IAP_CONSUMABLES.tokensLarge.tokens, 1500);
  assert.equal(
    IAP_PRODUCTS.consumables.tokensSmall.productId,
    'app.choremaxx.household.premium.tokens.small'
  );
});

test('top-up consumption is oldest-first', () => {
  const { grants, consumed } = applyTopUpConsumption(
    [
      {
        id: 'a',
        householdId: 'h',
        pack: 'small',
        tokens: 10,
        consumed: 8,
        transactionId: '1',
        grantedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b',
        householdId: 'h',
        pack: 'medium',
        tokens: 100,
        consumed: 0,
        transactionId: '2',
        grantedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    5
  );
  assert.equal(consumed, 5);
  assert.equal(grants[0]!.consumed, 10);
  assert.equal(grants[1]!.consumed, 3);
  assert.equal(topUpBalanceFromGrants(grants), 97);
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

test('Expo Go mock token grant is clearly marked', async () => {
  assert.equal(isNativeIapAvailable(), false);
  const grant = await purchaseTokens('tokensMedium', 'hh-mock');
  assert.equal(grant.pack, 'mock');
  assert.match(grant.transactionId, /^mock-/);
  assert.ok(grant.tokens > 0);
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
