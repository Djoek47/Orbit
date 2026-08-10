/**
 * Apple IAP product catalog + entitlement stub (weekend A3).
 *
 * Native StoreKit / expo-iap wiring lands on TestFlight builds.
 * Expo Go uses the mock entitlement store below.
 *
 * Pricing lock (Master Brief / weekend playbook):
 *   7-day free trial · $4.99/mo · $48/yr (+ tax via Apple)
 */

export const BILLING_TRIAL_DAYS = 7;

export const IAP_PRODUCTS = {
  monthly: {
    productId: 'app.choremaxx.household.premium.monthly',
    label: 'Premium Monthly',
    priceUsd: 4.99,
    period: 'month' as const,
    trialDays: BILLING_TRIAL_DAYS,
  },
  yearly: {
    productId: 'app.choremaxx.household.premium.yearly',
    label: 'Premium Yearly',
    priceUsd: 48,
    period: 'year' as const,
    trialDays: BILLING_TRIAL_DAYS,
    /** vs 12 × $4.99 */
    savingsLabel: '20% off',
  },
} as const;

export type IapProductKey = keyof typeof IAP_PRODUCTS;
export type IapProductId = (typeof IAP_PRODUCTS)[IapProductKey]['productId'];

export type EntitlementState = {
  active: boolean;
  productId: IapProductId | null;
  /** ISO — trial or paid period end */
  expiresAt: string | null;
  source: 'mock' | 'storekit' | 'none';
  inTrial: boolean;
};

export const EMPTY_ENTITLEMENT: EntitlementState = {
  active: false,
  productId: null,
  expiresAt: null,
  source: 'none',
  inTrial: false,
};

/** Mock-only entitlement for Expo Go / unit tests. */
let mockEntitlement: EntitlementState = { ...EMPTY_ENTITLEMENT };

export function getMockEntitlement(): EntitlementState {
  return { ...mockEntitlement };
}

export function setMockEntitlement(next: Partial<EntitlementState>): EntitlementState {
  mockEntitlement = { ...mockEntitlement, ...next, source: next.source ?? 'mock' };
  return getMockEntitlement();
}

export function clearMockEntitlement(): EntitlementState {
  mockEntitlement = { ...EMPTY_ENTITLEMENT };
  return getMockEntitlement();
}

export function isPremiumActive(state: EntitlementState = getMockEntitlement(), now = new Date()): boolean {
  if (!state.active) return false;
  if (!state.expiresAt) return true;
  return new Date(state.expiresAt).getTime() > now.getTime();
}

/**
 * Start a mock trial (Expo Go). Real purchases go through StoreKit on device builds.
 */
export function startMockTrial(productKey: IapProductKey = 'monthly', now = new Date()): EntitlementState {
  const product = IAP_PRODUCTS[productKey];
  const expires = new Date(now);
  expires.setDate(expires.getDate() + product.trialDays);
  return setMockEntitlement({
    active: true,
    productId: product.productId,
    expiresAt: expires.toISOString(),
    source: 'mock',
    inTrial: true,
  });
}

export const ASC_IAP_SETUP_NOTES = [
  'App Store Connect → Subscriptions → create Premium group',
  `Monthly: ${IAP_PRODUCTS.monthly.productId} @ $4.99 with ${BILLING_TRIAL_DAYS}-day free trial`,
  `Yearly: ${IAP_PRODUCTS.yearly.productId} @ $48 with ${BILLING_TRIAL_DAYS}-day free trial`,
  'Wire expo-iap or StoreKit 2 on next native TestFlight after products are Approved',
] as const;
