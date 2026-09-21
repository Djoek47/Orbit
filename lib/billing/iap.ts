/**
 * Billing / IAP facade.
 * Expo Go → mock trial / mock token grant. Native TestFlight/production → StoreKit via expo-iap.
 *
 * Purchase order (all paths): validate → grant → finish. Finish failures retry; never swallow.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ASC_IAP_SETUP_NOTES,
  clearMockEntitlement,
  EMPTY_ENTITLEMENT,
  getMockEntitlement,
  IAP_CONSUMABLES,
  IAP_PRODUCTS,
  IAP_SUBSCRIPTIONS,
  isPremiumActive,
  setMockEntitlement,
  startMockTrial,
  tokenPackForProductId,
  type EntitlementState,
  type IapProductId,
  type IapProductKey,
  type IapTokenPackKey,
} from '@/constants/billing';
import type { TokenGrant } from '@/lib/billing/token-grants';

export { IAP_PRODUCTS, IAP_CONSUMABLES, ASC_IAP_SETUP_NOTES, isPremiumActive };
export type { EntitlementState, IapProductKey, IapTokenPackKey };

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
  if (productId === IAP_SUBSCRIPTIONS.monthly.productId) return 'monthly';
  if (productId === IAP_SUBSCRIPTIONS.yearly.productId) return 'yearly';
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
  const product = key ? IAP_SUBSCRIPTIONS[key] : IAP_SUBSCRIPTIONS.monthly;
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

function purchaseTransactionId(purchase: Record<string, unknown>): string {
  const id =
    purchase.transactionId ??
    purchase.id ??
    purchase.purchaseToken ??
    purchase.transactionIdentifierIOS;
  if (typeof id === 'string' && id.trim()) return id.trim();
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Finish with retry — never swallow; leave purchase resumable on failure. */
async function finishPurchaseWithRetry(
  iap: typeof import('expo-iap'),
  purchase: Record<string, unknown>,
  isConsumable: boolean
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await iap.finishTransaction({
        purchase: purchase as never,
        isConsumable,
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`finishTransaction failed: ${String(lastError)}`);
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
        IAP_SUBSCRIPTIONS.monthly.productId,
        IAP_SUBSCRIPTIONS.yearly.productId,
      ]);
      const first = Array.isArray(active) ? active[0] : null;
      if (!first) {
        return persisted ?? EMPTY_ENTITLEMENT;
      }
      const productId = String(
        (first as { productId?: string }).productId ?? IAP_SUBSCRIPTIONS.monthly.productId
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
      return persistEntitlement(state);
    });
  } catch (error) {
    console.warn('fetchEntitlement StoreKit skipped', error);
    return persisted ?? getMockEntitlement();
  }
}

export async function purchasePremium(
  productKey: IapProductKey = 'monthly'
): Promise<EntitlementState> {
  const product = IAP_SUBSCRIPTIONS[productKey];

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
    // validate → grant entitlement → finish
    if (!productKeyForId(productId)) {
      throw new Error('unknown_subscription_product');
    }
    const state = entitlementFromPurchase({
      productId,
      inTrial: true,
    });
    await persistEntitlement(state);
    await finishPurchaseWithRetry(iap, purchase, false);
    return state;
  });
}

/**
 * Purchase a consumable token pack.
 * Order: validate product → grant tokens → finish (isConsumable: true).
 * Expo Go: mock grant only (clearly marked; unreachable in production builds).
 */
export async function purchaseTokens(
  packKey: IapTokenPackKey,
  householdId: string
): Promise<TokenGrant> {
  const pack = IAP_CONSUMABLES[packKey];
  if (!pack) throw new Error('unknown_token_pack');

  if (!isNativeIapAvailable()) {
    // Mock grant — Expo Go / unit tests only. Do not import the RN storage path in Node.
    const grant: TokenGrant = {
      id: `mock-${packKey}-${Date.now()}`,
      householdId,
      pack: 'mock',
      tokens: 50,
      consumed: 0,
      transactionId: `mock-${packKey}-${Date.now()}`,
      grantedAt: new Date().toISOString(),
    };
    try {
      const { grantTokenPack } = await import('@/lib/billing/token-grants');
      return await grantTokenPack({
        householdId,
        packKey: 'mock',
        transactionId: grant.transactionId,
        mock: true,
      });
    } catch {
      return grant;
    }
  }

  return withNativeIap(async (iap) => {
    await iap.initConnection();
    await iap.fetchProducts({
      skus: [pack.productId],
      type: 'in-app',
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
          type: 'in-app',
          request: {
            apple: { sku: pack.productId },
            google: {
              skus: [pack.productId],
            },
          },
        })
        .catch((error: unknown) => {
          removeUpdated.remove();
          removeError.remove();
          reject(error);
        });
    });

    const productId = String(purchase.productId ?? pack.productId);
    const matched = tokenPackForProductId(productId);
    if (!matched || matched.pack !== pack.pack) {
      throw new Error('token_pack_product_mismatch');
    }

    const transactionId = purchaseTransactionId(purchase);
    const { grantTokenPack } = await import('@/lib/billing/token-grants');
    const grant = await grantTokenPack({
      householdId,
      packKey,
      transactionId,
      productId,
    });

    await finishPurchaseWithRetry(iap, purchase, true);
    return grant;
  });
}

/**
 * Restore subscriptions only — getAvailablePurchases returns non-consumables
 * and subscriptions by design (expo-iap 5.2.4). Consumables are not restored.
 * `restorePurchases()` remains a real method in 5.2.4 (not a legacy alias).
 */
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
          id === IAP_SUBSCRIPTIONS.monthly.productId ||
          id === IAP_SUBSCRIPTIONS.yearly.productId
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
    return 'Start a 7-day free trial — then $6.99/mo or $49.99/yr.';
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
