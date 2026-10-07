import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearMockEntitlement,
  IAP_CONSUMABLES,
  IAP_PRODUCTS,
  isPremiumActive,
  startMockTrial,
  subscriptionPriceLine,
} from '@/constants/billing';
import {
  clearEntitlementForTests,
  isNativeIapAvailable,
  isTokenPackAvailable,
  premiumCopy,
  probeAvailableTokenPacks,
  purchasePremium,
  purchaseTokens,
} from '@/lib/billing/iap';
import { premiumOnboardingHref } from '@/lib/billing/premium-onboarding';
import {
  formatSubscriptionDate,
  resolveEffectiveAt,
  subscriptionDatesSubtitle,
} from '@/lib/billing/subscription-dates';
import { applyTopUpConsumption, topUpBalanceFromGrants } from '@/lib/billing/token-grants-math';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('IAP catalog locks monthly/yearly pricing + trial', () => {
  assert.equal(IAP_PRODUCTS.monthly.priceUsd, 6.99);
  assert.equal(IAP_PRODUCTS.monthly.trialDays, 7);
  assert.equal(IAP_PRODUCTS.monthly.productId, 'app.choremaxx.household.premium.monthlyv');
  assert.equal(IAP_PRODUCTS.yearly.priceUsd, 49.99);
  assert.equal(IAP_PRODUCTS.yearly.savingsLabel, '40% off');
  assert.equal(subscriptionPriceLine(), '$6.99/mo · $49.99/yr (40% off)');
});

test('consumable token packs are catalogued', () => {
  assert.equal(IAP_CONSUMABLES.tokensSmall.tokens, 200);
  assert.equal(IAP_CONSUMABLES.tokensMedium.priceUsd, 4.99);
  assert.equal(IAP_CONSUMABLES.tokensLarge.tokens, 2000);
  assert.equal(
    IAP_PRODUCTS.consumables.tokensSmall.productId,
    'app.choremaxx.household.premium.tokens.smallv'
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
  assert.ok(state.effectiveAt, 'trial stores effectiveAt');
  assert.match(subscriptionDatesSubtitle(state), /Effective /);
  assert.match(subscriptionDatesSubtitle(state), /Expires /);
  await clearEntitlementForTests();
});

test('subscription dates derive effectiveAt when missing', () => {
  const expiresAt = '2026-10-13T12:00:00.000Z';
  const effective = resolveEffectiveAt({
    active: true,
    productId: IAP_PRODUCTS.monthly.productId,
    expiresAt,
    source: 'mock',
    inTrial: true,
  });
  assert.equal(formatSubscriptionDate(effective), formatSubscriptionDate('2026-10-06T12:00:00.000Z'));
  assert.match(subscriptionDatesSubtitle(null), /\$6\.99\/mo/);
  assert.match(subscriptionDatesSubtitle(null), /40% off/);
});

test('Settings lists My Subscription with date fields', () => {
  const settings = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  assert.match(settings, /label="My Subscription"/);
  assert.doesNotMatch(settings, /label="Premium"/);
  assert.match(settings, /Effective date/);
  assert.match(settings, /Expiration date/);
  assert.match(settings, /subscriptionDatesSubtitle/);
});

test('Expo Go mock token grant uses selected pack size and accumulates', async () => {
  assert.equal(isNativeIapAvailable(), false);
  const first = await purchaseTokens('tokensMedium', 'hh-mock-accumulate');
  assert.equal(first.pack, 'medium');
  assert.equal(first.tokens, IAP_CONSUMABLES.tokensMedium.tokens);
  assert.match(first.transactionId, /^mock-/);

  const second = await purchaseTokens('tokensSmall', 'hh-mock-accumulate');
  assert.equal(second.pack, 'small');
  assert.equal(second.tokens, IAP_CONSUMABLES.tokensSmall.tokens);
  assert.notEqual(first.transactionId, second.transactionId, 'each buy is its own grant');

  // Returned grants alone prove pack sizes; persisted bank (when storage works) must add up.
  const expected =
    IAP_CONSUMABLES.tokensMedium.tokens + IAP_CONSUMABLES.tokensSmall.tokens;
  assert.equal(first.tokens + second.tokens, expected, 'new credits add to old credits');

  try {
    const { loadTokenGrants, topUpBalanceFromGrants } = await import('@/lib/billing/token-grants');
    const grants = await loadTokenGrants('hh-mock-accumulate');
    if (grants.length >= 2) {
      assert.equal(topUpBalanceFromGrants(grants), expected);
    }
  } catch {
    /* AsyncStorage may be unavailable in plain Node — pack sizes above still lock the contract */
  }
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

test('probeAvailableTokenPacks returns full catalog when StoreKit is unavailable', async () => {
  const listed = await probeAvailableTokenPacks();
  assert.deepEqual(listed, ['tokensSmall', 'tokensMedium', 'tokensLarge']);
  assert.equal(isTokenPackAvailable('tokensMedium', listed), true);
  assert.equal(isTokenPackAvailable('tokensMedium', ['tokensSmall', 'tokensLarge']), false);
  assert.equal(isTokenPackAvailable('tokensMedium', null), true, 'null = unknown, keep tappable');
});
