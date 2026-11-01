import assert from 'node:assert/strict';

import {
  effectiveEntitlement,
  entitlementFromHousehold,
  HOUSEHOLD_PREMIUM_GRACE_MS,
  HOUSEHOLD_PREMIUM_RENEWING_GRACE_MS,
  householdPremiumKnown,
  isFreeTrialOffer,
  syncPayloadFromPurchase,
} from './household-entitlement';
import { isPremiumActive, type EntitlementState } from '../../constants/billing';
import type { HouseholdPremium } from '../../types/orbit';

const NOW = new Date('2026-10-07T12:00:00Z');
const DAY = 86_400_000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const house = (p: Partial<HouseholdPremium>): HouseholdPremium => ({
  productId: 'app.choremaxx.household.premium.monthlyv',
  inTrial: false,
  expiresAt: at(20 * DAY),
  environment: 'Production',
  updatedAt: NOW.toISOString(),
  willRenew: true,
  ...p,
});

const local = (p: Partial<EntitlementState>): EntitlementState => ({
  active: true,
  productId: 'app.choremaxx.household.premium.monthlyv',
  effectiveAt: NOW.toISOString(),
  expiresAt: at(20 * DAY),
  source: 'storekit',
  inTrial: false,
  ...p,
});

// ── The household row ─────────────────────────────────────────────────────────
assert.equal(entitlementFromHousehold(undefined, NOW), null, 'no row, nothing to show');
assert.equal(entitlementFromHousehold(house({ expiresAt: null }), NOW), null, 'never subscribed');
assert.equal(entitlementFromHousehold(house({ expiresAt: 'garbage' }), NOW), null);

const fromRow = entitlementFromHousehold(house({}), NOW)!;
assert.equal(isPremiumActive(fromRow, NOW), true);

// The grace period. A renewal Apple charged for only reaches the row when an admin opens the
// app, so a household that has not cancelled keeps working on the children's devices for
// Apple's whole billing grace period. One that cancelled gets two days.
const renewingWeekLate = entitlementFromHousehold(house({ expiresAt: at(-7 * DAY), willRenew: true }), NOW)!;
assert.equal(isPremiumActive(renewingWeekLate, NOW), true, 'renewing: a week late still works');
const renewingTooLate = entitlementFromHousehold(house({ expiresAt: at(-17 * DAY), willRenew: true }), NOW)!;
assert.equal(isPremiumActive(renewingTooLate, NOW), false, 'renewing: past 16 days does not');

const cancelledDayLate = entitlementFromHousehold(house({ expiresAt: at(-1 * DAY), willRenew: false }), NOW)!;
assert.equal(isPremiumActive(cancelledDayLate, NOW), true, 'cancelled: a day late still works');
const cancelledLate = entitlementFromHousehold(house({ expiresAt: at(-3 * DAY), willRenew: false }), NOW)!;
assert.equal(isPremiumActive(cancelledLate, NOW), false, 'cancelled: three days late does not');

// Rows written before the field existed lean towards the family, not the lockout.
const legacy = entitlementFromHousehold(house({ expiresAt: at(-7 * DAY), willRenew: null }), NOW)!;
assert.equal(isPremiumActive(legacy, NOW), true);
assert.equal(HOUSEHOLD_PREMIUM_GRACE_MS, 2 * DAY);
assert.equal(HOUSEHOLD_PREMIUM_RENEWING_GRACE_MS, 16 * DAY);

// "Known" means a period was ever recorded — the difference between "never told" and "ended".
assert.equal(householdPremiumKnown(undefined), false, 'server without the migration');
assert.equal(householdPremiumKnown(house({ expiresAt: null })), false, 'never synced');
assert.equal(householdPremiumKnown(house({})), true);

// ── Merging device and house ──────────────────────────────────────────────────
// The shared tablet: nothing local, house paid → paid.
assert.equal(effectiveEntitlement(null, house({}), NOW).inTrial, false);
assert.equal(isPremiumActive(effectiveEntitlement(null, house({}), NOW), NOW), true);

// The purchasing phone before the row exists (migration not applied yet) → its own StoreKit.
assert.equal(isPremiumActive(effectiveEntitlement(local({}), undefined, NOW), NOW), true);

// Paid beats trial, whichever side it is on.
const paidHere = effectiveEntitlement(local({ inTrial: false }), house({ inTrial: true }), NOW);
assert.equal(paidHere.inTrial, false, 'converted on this phone, row still says trial');
const paidThere = effectiveEntitlement(local({ inTrial: true }), house({ inTrial: false }), NOW);
assert.equal(paidThere.inTrial, false, 'another admin pays, this phone is on a trial');

// Same tier: the longer one.
const longer = effectiveEntitlement(
  local({ expiresAt: at(5 * DAY) }),
  house({ expiresAt: at(300 * DAY), productId: 'app.choremaxx.household.premium.yearlyv' }),
  NOW
);
assert.equal(longer.productId, 'app.choremaxx.household.premium.yearlyv');

// Nothing anywhere → not active, and never a crash.
assert.equal(isPremiumActive(effectiveEntitlement(null, undefined, NOW), NOW), false);
assert.equal(
  isPremiumActive(effectiveEntitlement(local({ active: false }), house({ expiresAt: at(-9 * DAY), willRenew: false }), NOW), NOW),
  false
);

// ── StoreKit's answer about the trial ─────────────────────────────────────────
// expo-iap has spelled this three ways across versions.
assert.equal(isFreeTrialOffer({ type: 'introductory', paymentMode: 'free-trial' }), true);
assert.equal(isFreeTrialOffer({ type: 'Introductory', paymentMode: 'FreeTrial' }), true);
assert.equal(isFreeTrialOffer({ type: 'INTRODUCTORY', paymentMode: 'FREE_TRIAL' }), true);
// An introductory offer that is a discounted price is not a free trial.
assert.equal(isFreeTrialOffer({ type: 'introductory', paymentMode: 'pay-as-you-go' }), false);
assert.equal(isFreeTrialOffer({ type: 'promotional', paymentMode: 'free-trial' }), false);
assert.equal(isFreeTrialOffer(null), false, 'no offer means a paid period');
assert.equal(isFreeTrialOffer(undefined), false);

// ── What the phone sends the server ───────────────────────────────────────────
const payload = syncPayloadFromPurchase(
  {
    productId: 'app.choremaxx.household.premium.monthlyv',
    originalTransactionIdentifierIOS: '2000000123',
    expirationDateIOS: NOW.getTime() + 7 * DAY,
    environmentIOS: 'Sandbox',
    offerIOS: { type: 'introductory', paymentMode: 'free-trial' },
    renewalInfoIOS: { willAutoRenew: false },
  },
  'house-1'
)!;
assert.equal(payload.willRenew, false, 'the cancel switch travels with the report');
assert.equal(payload.originalTransactionId, '2000000123');
assert.equal(payload.inTrial, true);
assert.equal(payload.environment, 'Sandbox');
assert.equal(payload.expiresAtMs, NOW.getTime() + 7 * DAY);

// Missing pieces → nothing sent, rather than a half-true record.
assert.equal(syncPayloadFromPurchase({ productId: 'x' }, 'h'), null);
assert.equal(
  syncPayloadFromPurchase({ productId: 'x', originalTransactionIdentifierIOS: '1' }, 'h'),
  null,
  'no expiry'
);

console.log('household-entitlement: ok');
