/**
 * Billing / IAP facade — Expo Go uses mock entitlements; native builds will
 * call StoreKit via expo-iap once ASC products exist (weekend A3).
 */
import {
  ASC_IAP_SETUP_NOTES,
  clearMockEntitlement,
  EMPTY_ENTITLEMENT,
  getMockEntitlement,
  IAP_PRODUCTS,
  isPremiumActive,
  startMockTrial,
  type EntitlementState,
  type IapProductKey,
} from '@/constants/billing';
import { dataMode } from '@/config/data-mode';

export { IAP_PRODUCTS, ASC_IAP_SETUP_NOTES, isPremiumActive };
export type { EntitlementState, IapProductKey };

export async function fetchEntitlement(): Promise<EntitlementState> {
  // Native StoreKit path lands after ASC products + expo-iap install.
  // Until then every runtime uses the mock stub (safe for Expo Go).
  if (dataMode === 'mock') {
    return getMockEntitlement();
  }
  return getMockEntitlement();
}

export async function purchasePremium(productKey: IapProductKey): Promise<EntitlementState> {
  // Placeholder until StoreKit products are live — starts mock trial so UI can be built.
  return startMockTrial(productKey);
}

export async function restorePurchases(): Promise<EntitlementState> {
  return getMockEntitlement();
}

export async function clearEntitlementForTests(): Promise<EntitlementState> {
  return clearMockEntitlement();
}

export function premiumCopy(state: EntitlementState): string {
  if (!isPremiumActive(state)) {
    return 'Start a 7-day free trial — then $4.99/mo or $48/yr.';
  }
  if (state.inTrial) {
    return 'Premium trial active.';
  }
  return 'Premium active.';
}

export const billingFacadeReady = true;
export const emptyEntitlement = EMPTY_ENTITLEMENT;
