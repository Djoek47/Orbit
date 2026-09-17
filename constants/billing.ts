/**
 * Apple IAP product catalog + entitlement stub.
 *
 * Native StoreKit / expo-iap wiring lands on TestFlight builds.
 * Expo Go uses the mock entitlement store below.
 *
 * Pricing lock:
 *   7-day free trial · $6.99/mo · $49.99/yr (+ tax via Apple)
 *   Yearly = 40% off vs 12 × $6.99. Same $49.99 on web.
 */
import { TOKENS_PER_DAY, TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';

export const BILLING_TRIAL_DAYS = 7;

export const IAP_PRODUCTS = {
  monthly: {
    productId: 'app.choremaxx.household.premium.monthly',
    label: 'Premium Monthly',
    priceUsd: 6.99,
    period: 'month' as const,
    trialDays: BILLING_TRIAL_DAYS,
  },
  yearly: {
    productId: 'app.choremaxx.household.premium.yearly',
    label: 'Premium Yearly',
    priceUsd: 49.99,
    period: 'year' as const,
    trialDays: BILLING_TRIAL_DAYS,
    /** vs 12 × $6.99 = $83.88 */
    savingsLabel: '40% off',
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
export function startMockTrial(productKey: IapProductKey = 'yearly', now = new Date()): EntitlementState {
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

export const PREMIUM_ALLOWANCE_COPY = `${TOKENS_PER_MONTH} Poppins actions a month, ${TOKENS_PER_DAY} a day.`;

export const ASC_IAP_SETUP_NOTES = [
  'ASC Premium group — monthly + yearly products (confirm price points in App Store Connect)',
  `Monthly: ${IAP_PRODUCTS.monthly.productId} @ $6.99 with ${BILLING_TRIAL_DAYS}-day free trial`,
  `Yearly: ${IAP_PRODUCTS.yearly.productId} @ $49.99 with ${BILLING_TRIAL_DAYS}-day free trial (lead CTA · 40% off)`,
  'Paywall: /premium after email confirm; StoreKit via expo-iap on TestFlight',
] as const;
