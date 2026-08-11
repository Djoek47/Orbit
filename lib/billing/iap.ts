/**
 * Billing / IAP facade.
 * Expo Go → mock trial. Native TestFlight/production → StoreKit via expo-iap.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ASC_IAP_SETUP_NOTES,
  clearMockEntitlement,
  EMPTY_ENTITLEMENT,
  getMockEntitlement,
  IAP_PRODUCTS,
  isPremiumActive,
  setMockEntitlement,
  startMockTrial,
  type EntitlementState,
  type IapProductId,
  type IapProductKey,
} from '@/constants/billing';

export { IAP_PRODUCTS, ASC_IAP_SETUP_NOTES, isPremiumActive };
export type { EntitlementState, IapProductKey };

const ENTITLEMENT_KEY = '@orbit/premium_entitlement';

let cachedEntitlement: EntitlementState | null = null;

function readPlatformOs(): string {
  try {
    // Soft require so Node unit tests don't load react-native's broken index.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return String(require('react-native').Platform?.OS ?? 'web');
  } catch {
    return 'web';
  }
}

function readAppOwnership(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-constants').default?.appOwnership ?? null;
  } catch {
    return null;
  }
}

function productKeyForId(productId: string | null | undefined): IapProductKey | null {
  if (!productId) return null;
  if (productId === IAP_PRODUCTS.monthly.productId) return 'monthly';
  if (productId === IAP_PRODUCTS.yearly.productId) return 'yearly';
  return null;
}

async function persistEntitlement(state: EntitlementState): Promise<EntitlementState> {
  cachedEntitlement = state;
  try {
    await AsyncStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('persistEntitlement failed', error);
  }
  return state;
}

async function loadPersistedEntitlement(): Promise<EntitlementState | null> {
  if (cachedEntitlement) return cachedEntitlement;
  try {
    const raw = await AsyncStorage.getItem(ENTITLEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EntitlementState;
    if (!parsed || typeof parsed !== 'object') return null;
    cachedEntitlement = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/** True when a native StoreKit binary is available (not Expo Go / web). */
export function isNativeIapAvailable(): boolean {
  const os = readPlatformOs();
  if (os === 'web' || os === 'node') return false;
  // Expo Go cannot load custom native IAP modules.
  if (readAppOwnership() === 'expo') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoIap = require('expo-iap');
    return Boolean(ExpoIap?.initConnection);
  } catch {
    return false;
  }
}

async function withNativeIap<T>(fn: (iap: typeof import('expo-iap')) => Promise<T>): Promise<T> {
  // Dynamic import keeps Expo Go from hard-crashing when the native module is absent.
  const iap = await import('expo-iap');
  return fn(iap);
}

function entitlementFromPurchase(opts: {
  productId: string;
  expiresAt?: string | null;
  inTrial?: boolean;
}): EntitlementState {
  const key = productKeyForId(opts.productId);
  const product = key ? IAP_PRODUCTS[key] : IAP_PRODUCTS.monthly;
  let expiresAt = opts.expiresAt ?? null;
  if (!expiresAt) {
    const expires = new Date();
    expires.setDate(expires.getDate() + (opts.inTrial ? product.trialDays : 31));
    expiresAt = expires.toISOString();
  }
  return {
    active: true,
    productId: (key ? product.productId : opts.productId) as IapProductId,
    expiresAt,
    source: 'storekit',
    inTrial: Boolean(opts.inTrial),
  };
}

export async function fetchEntitlement(): Promise<EntitlementState> {
  const persisted = await loadPersistedEntitlement();
  if (persisted && isPremiumActive(persisted)) {
    return persisted;
  }

  if (!isNativeIapAvailable()) {
    const mock = getMockEntitlement();
    return isPremiumActive(mock) ? mock : persisted ?? EMPTY_ENTITLEMENT;
  }

  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      const active = await iap.getActiveSubscriptions([
        IAP_PRODUCTS.monthly.productId,
        IAP_PRODUCTS.yearly.productId,
      ]);
      const first = Array.isArray(active) ? active[0] : null;
      if (!first) {
        return persisted ?? EMPTY_ENTITLEMENT;
      }
      const productId = String(
        (first as { productId?: string }).productId ?? IAP_PRODUCTS.monthly.productId
      );
      const rawExpiry = (first as { expirationDateIOS?: string | number | null }).expirationDateIOS;
      const expiresAt =
        typeof rawExpiry === 'string'
          ? rawExpiry
          : typeof rawExpiry === 'number'
            ? new Date(rawExpiry).toISOString()
            : null;
      const state = entitlementFromPurchase({
        productId,
        expiresAt,
        inTrial: false,
      });
      // Prefer StoreKit truth when active.
      return persistEntitlement(state);
    });
  } catch (error) {
    console.warn('fetchEntitlement StoreKit skipped', error);
    return persisted ?? getMockEntitlement();
  }
}

export async function purchasePremium(productKey: IapProductKey = 'monthly'): Promise<EntitlementState> {
  const product = IAP_PRODUCTS[productKey];

  if (!isNativeIapAvailable()) {
    const mock = startMockTrial(productKey);
    return persistEntitlement(mock);
  }

  return withNativeIap(async (iap) => {
    await iap.initConnection();
    await iap.fetchProducts({
      skus: [product.productId],
      type: 'subs',
    });

    const purchase = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const removeUpdated = iap.purchaseUpdatedListener((event) => {
        removeUpdated.remove();
        removeError.remove();
        resolve(event as unknown as Record<string, unknown>);
      });
      const removeError = iap.purchaseErrorListener((error) => {
        removeUpdated.remove();
        removeError.remove();
        reject(error);
      });

      void iap
        .requestPurchase({
          type: 'subs',
          request: {
            apple: { sku: product.productId },
            google: {
              skus: [product.productId],
              subscriptionOffers: [],
            },
          },
        })
        .catch((error: unknown) => {
          removeUpdated.remove();
          removeError.remove();
          reject(error);
        });
    });

    const productId = String(purchase.productId ?? product.productId);
    try {
      await iap.finishTransaction({
        purchase: purchase as never,
        isConsumable: false,
      });
    } catch (error) {
      console.warn('finishTransaction skipped', error);
    }

    // Introductory offer → treat first purchase as trial window.
    const state = entitlementFromPurchase({
      productId,
      inTrial: true,
    });
    return persistEntitlement(state);
  });
}

export async function restorePurchases(): Promise<EntitlementState> {
  if (!isNativeIapAvailable()) {
    const mock = getMockEntitlement();
    if (isPremiumActive(mock)) return persistEntitlement(mock);
    const persisted = await loadPersistedEntitlement();
    return persisted ?? EMPTY_ENTITLEMENT;
  }

  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      await iap.restorePurchases();
      const purchases = await iap.getAvailablePurchases();
      const list = Array.isArray(purchases) ? purchases : [];
      const match = list.find((item) => {
        const id = String((item as { productId?: string }).productId ?? '');
        return (
          id === IAP_PRODUCTS.monthly.productId || id === IAP_PRODUCTS.yearly.productId
        );
      });
      if (!match) {
        return EMPTY_ENTITLEMENT;
      }
      const state = entitlementFromPurchase({
        productId: String((match as { productId: string }).productId),
        inTrial: false,
      });
      return persistEntitlement(state);
    });
  } catch (error) {
    console.warn('restorePurchases StoreKit skipped', error);
    const persisted = await loadPersistedEntitlement();
    return persisted ?? EMPTY_ENTITLEMENT;
  }
}

export async function clearEntitlementForTests(): Promise<EntitlementState> {
  cachedEntitlement = null;
  try {
    await AsyncStorage.removeItem(ENTITLEMENT_KEY);
  } catch {
    /* ignore */
  }
  return clearMockEntitlement();
}

export function premiumCopy(state: EntitlementState): string {
  if (!isPremiumActive(state)) {
    return 'Start a 7-day free trial — then $4.99/mo.';
  }
  if (state.inTrial) {
    return 'Premium trial active.';
  }
  return 'Premium active.';
}

export function isUserCancelledPurchase(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: string }).code ?? '').toLowerCase();
  const message = String((error as { message?: string }).message ?? '').toLowerCase();
  return (
    code.includes('user-cancelled') ||
    code.includes('user_cancelled') ||
    code.includes('e_user_cancelled') ||
    message.includes('cancelled') ||
    message.includes('canceled')
  );
}

export const billingFacadeReady = true;
export const emptyEntitlement = EMPTY_ENTITLEMENT;

/** @internal test helper — seed mock without StoreKit */
export function __setMockEntitlementForTests(next: Partial<EntitlementState>) {
  return setMockEntitlement(next);
}
