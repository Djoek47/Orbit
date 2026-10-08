/**
 * Billing / IAP facade.
 * Expo Go → mock trial / mock token grant. Native TestFlight/production → StoreKit via expo-iap.
 *
 * Purchase order (all paths): validate → grant → finish. Finish failures retry; never swallow.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ASC_IAP_SETUP_NOTES,
  BILLING_TRIAL_DAYS,
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
import {
  isFreeTrialOffer,
  syncPayloadFromPurchase,
} from '@/lib/billing/household-entitlement';
import {
  historyFromTransactions,
  mergeHistory,
  type HistoryEntry,
} from '@/lib/billing/subscription-status';
import type { TokenGrant } from '@/lib/billing/token-grants';
import { formatUnknownError } from '@/lib/errors/unknown-error';

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
  // Every period this phone has seen goes in the ledger. It is how the paywall knows, after a
  // trial has gone and StoreKit's active list is empty, that this house already had its trial.
  if (state.active && state.expiresAt && state.source !== 'mock') {
    const startedAt = state.effectiveAt ?? new Date().toISOString();
    void recordHistory([
      {
        id: `${state.productId ?? 'premium'}:${state.inTrial ? 'trial' : 'paid'}:${state.expiresAt}`,
        productId: state.productId,
        startedAt,
        endsAt: state.expiresAt,
        kind: state.inTrial ? 'trial' : 'paid',
      },
    ]);
  }
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

const HISTORY_KEY = '@orbit/premium_history.v1';

async function loadHistoryLedger(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).filter((e) => e && e.id) : [];
  } catch {
    return [];
  }
}

/** Writes run one after another, so two read-merge-writes cannot drop each other's entries. */
let historyChain: Promise<unknown> = Promise.resolve();

function recordHistory(entries: HistoryEntry[]): Promise<HistoryEntry[]> {
  const next = historyChain.then(async () => {
    const merged = mergeHistory(await loadHistoryLedger(), entries);
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
    } catch {
      /* best effort */
    }
    return merged;
  });
  historyChain = next.catch(() => undefined);
  return next;
}

/**
 * Every subscription period this Apple ID has had with ChoreMaxx, newest first: trials,
 * first payments and each renewal. From StoreKit's full transaction list where it can be read,
 * merged with what this phone has seen before, so it still answers offline and in Expo Go.
 */
export async function fetchSubscriptionHistory(): Promise<HistoryEntry[]> {
  if (!isNativeIapAvailable()) return loadHistoryLedger();
  try {
    const rows = await withNativeIap(async (iap) => {
      await iap.initConnection();
      const listed = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: false });
      return (Array.isArray(listed) ? listed : [])
        .map((row) => row as unknown as Record<string, unknown>)
        .filter((row) => SUBSCRIPTION_IDS.includes(String(row.productId ?? '')));
    });
    return recordHistory(historyFromTransactions(rows));
  } catch (error) {
    console.warn('fetchSubscriptionHistory', formatUnknownError(error, 'history failed'));
    return loadHistoryLedger();
  }
}

export type RenewalState = {
  /** False once the person turned auto-renew off in Apple's settings. Null when unknown. */
  willRenew: boolean | null;
  /** ISO. When Apple will next charge (or, if cancelled, when access ends). */
  renewalDate: string | null;
  /** The plan the next renewal moves to, when an upgrade or downgrade is pending. */
  pendingProductId: string | null;
};

/** Apple's renewal status for the active subscription: will it renew, and when. */
export async function fetchRenewalState(): Promise<RenewalState> {
  const unknown: RenewalState = { willRenew: null, renewalDate: null, pendingProductId: null };
  if (!isNativeIapAvailable()) {
    const mock = getMockEntitlement();
    return isPremiumActive(mock)
      ? { willRenew: true, renewalDate: mock.expiresAt, pendingProductId: null }
      : unknown;
  }
  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      const subs = await iap.getActiveSubscriptions(SUBSCRIPTION_IDS);
      const list = (Array.isArray(subs) ? subs : []) as unknown as Record<string, unknown>[];
      const best = list.reduce<Record<string, unknown> | null>((a, b) => {
        const exp = (r: Record<string, unknown> | null) =>
          typeof r?.expirationDateIOS === 'number' ? r.expirationDateIOS : 0;
        return exp(b) > exp(a) ? b : a;
      }, null);
      if (!best) return unknown;
      const info = (best.renewalInfoIOS ?? null) as {
        willAutoRenew?: boolean;
        renewalDate?: number | null;
        pendingUpgradeProductId?: string | null;
        autoRenewPreference?: string | null;
      } | null;
      const renewalMs =
        typeof info?.renewalDate === 'number'
          ? info.renewalDate
          : typeof best.expirationDateIOS === 'number'
            ? best.expirationDateIOS
            : null;
      const pending =
        info?.pendingUpgradeProductId ??
        (info?.autoRenewPreference && info.autoRenewPreference !== best.productId
          ? info.autoRenewPreference
          : null);
      return {
        willRenew:
          typeof info?.willAutoRenew === 'boolean'
            ? info.willAutoRenew
            : typeof best.autoRenewingAndroid === 'boolean'
              ? best.autoRenewingAndroid
              : null,
        renewalDate: renewalMs ? new Date(renewalMs).toISOString() : null,
        pendingProductId: pending ?? null,
      };
    });
  } catch (error) {
    console.warn('fetchRenewalState', formatUnknownError(error, 'renewal read failed'));
    return unknown;
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
  effectiveAt?: string | null;
  inTrial?: boolean;
}): EntitlementState {
  const key = productKeyForId(opts.productId);
  const product = key ? IAP_SUBSCRIPTIONS[key] : IAP_SUBSCRIPTIONS.monthly;
  const effectiveAt = opts.effectiveAt ?? new Date().toISOString();
  let expiresAt = opts.expiresAt ?? null;
  if (!expiresAt) {
    const expires = new Date(effectiveAt);
    expires.setDate(expires.getDate() + (opts.inTrial ? product.trialDays : 31));
    expiresAt = expires.toISOString();
  }
  return {
    active: true,
    productId: (key ? product.productId : opts.productId) as IapProductId,
    effectiveAt,
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
    : new Error(`finishTransaction failed: ${formatUnknownError(lastError, 'finish failed')}`);
}

const SUBSCRIPTION_IDS: string[] = [
  IAP_SUBSCRIPTIONS.monthly.productId,
  IAP_SUBSCRIPTIONS.yearly.productId,
];

/**
 * What StoreKit itself says this Apple ID is entitled to right now.
 *
 * Reads Transaction.currentEntitlements (through getAvailablePurchases with active items only),
 * which is local and works offline. Every field comes from the transaction: the real expiry,
 * and whether this period is the free trial. The app used to fill those in itself — a fixed
 * 7 or 31 days, and a trial flag hardcoded to true on purchase and false on refresh — so a
 * household that paid up front had Poppins locked for a week, and one on its trial had it
 * unlocked after the first relaunch.
 *
 * Returns the purchase as well, so the caller can report it to the household.
 */
async function readStoreKitSubscription(
  iap: typeof import('expo-iap')
): Promise<{ state: EntitlementState; purchase: Record<string, unknown> } | null> {
  const listed = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  const subs = (Array.isArray(listed) ? listed : [])
    .map((row) => row as unknown as Record<string, unknown>)
    .filter((row) => SUBSCRIPTION_IDS.includes(String(row.productId ?? '')));
  if (subs.length === 0) return null;

  // Two products in one group can briefly both appear during an upgrade; the one that runs
  // longest is the one the household actually has.
  const expiryOf = (row: Record<string, unknown>) => {
    const raw = row.expirationDateIOS;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') return new Date(raw).getTime();
    return 0;
  };
  const best = subs.reduce((a, b) => (expiryOf(b) > expiryOf(a) ? b : a));
  const expiresMs = expiryOf(best);

  const state = entitlementFromPurchase({
    productId: String(best.productId),
    expiresAt: expiresMs > 0 ? new Date(expiresMs).toISOString() : null,
    effectiveAt:
      typeof best.transactionDate === 'number'
        ? new Date(best.transactionDate).toISOString()
        : null,
    inTrial: isFreeTrialOffer(best.offerIOS as { type?: unknown; paymentMode?: unknown } | null),
  });
  return { state, purchase: best };
}

/**
 * Tell the household about this phone's subscription, so the Sidekick phones and the shared
 * tablet — which never bought anything and cannot see this Apple ID's purchases — unlock too.
 *
 * Best effort and silent: it only ever moves the household forward, the server ignores
 * reports it cannot use, and a failure here must never stand between a paying admin and
 * their own app. Called after purchase, after restore, and on every refresh.
 */
export type HouseholdSyncResult = 'synced' | 'claimed-elsewhere' | 'skipped' | 'failed';

export async function syncHouseholdEntitlement(
  householdId: string | null | undefined,
  purchase: Record<string, unknown>
): Promise<HouseholdSyncResult> {
  if (!householdId) return 'skipped';
  const payload = syncPayloadFromPurchase(purchase, householdId);
  if (!payload) return 'skipped';
  try {
    const { getSupabaseClient } = await import('@/lib/supabase/client');
    const supabase = getSupabaseClient();
    if (!supabase) return 'skipped';
    const { error } = await supabase.functions.invoke('sync-entitlement', { body: payload });
    if (!error) return 'synced';
    // 409: this Apple ID's subscription already pays for a household someone else bought it
    // for. Supabase surfaces the status on the error's context response.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 409) return 'claimed-elsewhere';
    console.warn('syncHouseholdEntitlement', error.message);
    return 'failed';
  } catch (error) {
    console.warn('syncHouseholdEntitlement', formatUnknownError(error, 'sync failed'));
    return 'failed';
  }
}

/** The latest StoreKit purchase seen this session, so the store can sync it once it knows the house. */
let lastStoreKitPurchase: Record<string, unknown> | null = null;
export function latestStoreKitPurchase(): Record<string, unknown> | null {
  return lastStoreKitPurchase;
}

export async function fetchEntitlement(): Promise<EntitlementState> {
  const persisted = await loadPersistedEntitlement();

  if (!isNativeIapAvailable()) {
    const mock = getMockEntitlement();
    return isPremiumActive(mock) ? mock : persisted ?? EMPTY_ENTITLEMENT;
  }

  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      const found = await readStoreKitSubscription(iap);
      if (!found) {
        // StoreKit's own entitlement list is local and authoritative: nothing in it means this
        // Apple ID has nothing active. The household may still be paid through another admin;
        // that is merged in by the caller, not invented here.
        if (persisted) await persistEntitlement(EMPTY_ENTITLEMENT);
        return EMPTY_ENTITLEMENT;
      }
      lastStoreKitPurchase = found.purchase;
      return persistEntitlement(found.state);
    });
  } catch (error) {
    // StoreKit unreachable (rare — the read is local). Keep what we had rather than lock out.
    console.warn('fetchEntitlement StoreKit skipped', error);
    return persisted ?? EMPTY_ENTITLEMENT;
  }
}

/**
 * Will buying this subscription start a free trial for this Apple ID?
 *
 * Two conditions, both Apple's: the product must actually carry a free-trial introductory
 * offer in App Store Connect, and this Apple ID must not have used one in the group before.
 * The paywall used to promise "Free for 7 days" unconditionally — to a returning subscriber,
 * or against a product whose offer was never configured, Apple then charges on the spot while
 * the screen said free, which is both a refund and a guideline 3.1.2 rejection.
 *
 * Off-device (Expo Go, tests) the trial is mocked, so the answer is yes. If StoreKit cannot be
 * asked, also yes — the purchase sheet Apple shows is the final word, and a failed probe must
 * not hide the trial from someone who has it.
 */
export async function isTrialEligible(productKey: IapProductKey): Promise<boolean> {
  if (!isNativeIapAvailable()) return true;
  const product = IAP_SUBSCRIPTIONS[productKey];
  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      const listed = await iap.fetchProducts({ skus: [product.productId], type: 'subs' });
      const row = (Array.isArray(listed) ? listed[0] : null) as Record<string, unknown> | null;
      if (!row) return true;
      const mode = String(row.introductoryPricePaymentModeIOS ?? '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
      if (mode !== 'freetrial') return false;
      const group = row.subscriptionGroupIdIOS;
      if (typeof group !== 'string' || !group) return true;
      return Boolean(await iap.isEligibleForIntroOfferIOS(group));
    });
  } catch (error) {
    console.warn('isTrialEligible', formatUnknownError(error, 'probe failed'));
    return true;
  }
}

export type StorePrice = {
  /** Apple's own formatted price for this storefront, e.g. "CA$9.99". Show this, never USD. */
  display: string;
  value: number | null;
  currency: string | null;
};

/**
 * What each product costs in this Apple ID's storefront, as Apple formats it.
 *
 * The paywall and credits screen printed USD from the catalogue. Apple's purchase sheet shows
 * the storefront's price — CA$ in Canada, € in France — so a reviewer or customer outside the
 * US saw one price on screen and another on the sheet. That mismatch is one of the most common
 * guideline 3.1.2 rejections. Empty off-device or when StoreKit cannot be reached; callers fall
 * back to the catalogue only then.
 */
export async function fetchStorePrices(): Promise<Record<string, StorePrice>> {
  if (!isNativeIapAvailable()) return {};
  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      const subs = await iap.fetchProducts({ skus: SUBSCRIPTION_IDS, type: 'subs' }).catch(() => []);
      const packs = await iap
        .fetchProducts({
          skus: Object.values(IAP_CONSUMABLES).map((p) => p.productId),
          type: 'in-app',
        })
        .catch(() => []);
      const out: Record<string, StorePrice> = {};
      for (const raw of [...(Array.isArray(subs) ? subs : []), ...(Array.isArray(packs) ? packs : [])]) {
        const row = raw as unknown as Record<string, unknown>;
        const id = productIdFromStoreItem(row);
        const display = typeof row.displayPrice === 'string' ? row.displayPrice : '';
        if (!id || !display) continue;
        out[id] = {
          display,
          value: typeof row.price === 'number' ? row.price : null,
          currency: typeof row.currency === 'string' ? row.currency : null,
        };
      }
      return out;
    });
  } catch (error) {
    console.warn('fetchStorePrices', formatUnknownError(error, 'price fetch failed'));
    return {};
  }
}

/** A storefront price divided, formatted in its own currency — "about CA$5.83/mo". */
export function formatStoreFraction(price: StorePrice | undefined, divisor: number): string | null {
  if (!price || price.value == null || !price.currency || divisor <= 0) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(
      price.value / divisor
    );
  } catch {
    return null;
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
    const listed = await iap.fetchProducts({
      skus: [product.productId],
      type: 'subs',
    });
    // Asking StoreKit to buy a product it did not return fails with "SKU not found". Say
    // what that means instead: until Apple approves the subscription it cannot be sold.
    if (!Array.isArray(listed) || listed.length === 0) {
      throw new Error(
        'This plan is not available from the App Store yet. It opens once Apple approves it — try again later.'
      );
    }

    const purchase = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const removeUpdated = iap.purchaseUpdatedListener((event) => {
        const row = event as unknown as Record<string, unknown>;
        const eventProductId = String(row.productId ?? row.id ?? '');
        if (eventProductId && eventProductId !== product.productId) {
          return;
        }
        removeUpdated.remove();
        removeError.remove();
        resolve(row);
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
    await finishPurchaseWithRetry(iap, purchase, false);

    // Read the result back from StoreKit rather than guessing. Whether this is a free trial
    // depends on the user's eligibility, which only Apple knows: someone who had a trial
    // before pays today, and must not have Poppins locked for a week they already paid for.
    const found = await readStoreKitSubscription(iap).catch(() => null);
    if (found) {
      lastStoreKitPurchase = found.purchase;
      return persistEntitlement(found.state);
    }
    const state = entitlementFromPurchase({
      productId,
      expiresAt:
        typeof purchase.expirationDateIOS === 'number'
          ? new Date(purchase.expirationDateIOS).toISOString()
          : null,
      inTrial: isFreeTrialOffer(
        purchase.offerIOS as { type?: unknown; paymentMode?: unknown } | null
      ),
    });
    lastStoreKitPurchase = purchase;
    return persistEntitlement(state);
  });
}

function rejectPurchaseError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object') {
    const row = error as { message?: string; code?: string; isEmptyProductList?: boolean | null };
    if (row.isEmptyProductList) {
      return new Error('sku_not_found: App Store returned no credit packs for this build.');
    }
    return new Error(formatUnknownError(error, 'Failed to request purchase'));
  }
  return new Error(formatUnknownError(error, 'Failed to request purchase'));
}

const ALL_TOKEN_PACK_KEYS = Object.keys(IAP_CONSUMABLES) as IapTokenPackKey[];

function productIdFromStoreItem(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const row = item as { productId?: string; id?: string };
  return String(row.productId ?? row.id ?? '');
}

/**
 * Which credit packs StoreKit currently returns for this binary.
 * Expo Go / mock: all catalog packs. Native: only SKUs Apple lists for the build.
 * On probe failure: null (UI keeps packs tappable; purchase still validates).
 */
export async function probeAvailableTokenPacks(): Promise<IapTokenPackKey[] | null> {
  if (!isNativeIapAvailable()) {
    return [...ALL_TOKEN_PACK_KEYS];
  }

  try {
    return await withNativeIap(async (iap) => {
      await iap.initConnection();
      const skus = ALL_TOKEN_PACK_KEYS.map((key) => IAP_CONSUMABLES[key].productId);
      const listed = await iap.fetchProducts({
        skus,
        type: 'in-app',
      });
      const products = Array.isArray(listed) ? listed : [];
      const foundIds = new Set(
        products.map(productIdFromStoreItem).filter((id) => id.length > 0)
      );
      return ALL_TOKEN_PACK_KEYS.filter((key) => foundIds.has(IAP_CONSUMABLES[key].productId));
    });
  } catch (error) {
    console.warn('probeAvailableTokenPacks', formatUnknownError(error, 'probe failed'));
    return null;
  }
}

export function isTokenPackAvailable(
  packKey: IapTokenPackKey,
  available: IapTokenPackKey[] | null | undefined
): boolean {
  if (available == null) return true;
  return available.includes(packKey);
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
    // Mock grant — Expo Go / unit tests. Grants the selected pack size and appends
    // to the existing bank (credits never expire / never replace prior balance).
    const transactionId = `mock-${packKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { grantTokenPack } = await import('@/lib/billing/token-grants');
    return await grantTokenPack({
      householdId,
      packKey,
      transactionId,
      productId: pack.productId,
      mock: true,
    });
  }

  return withNativeIap(async (iap) => {
    await iap.initConnection();
    const listed = await iap.fetchProducts({
      skus: [pack.productId],
      type: 'in-app',
    });
    const products = Array.isArray(listed) ? listed : [];
    const found = products.some((item) => productIdFromStoreItem(item) === pack.productId);
    if (!found) {
      throw new Error(
        `sku_not_found: ${pack.productId} is not available from App Store Connect for this build.`
      );
    }

    const purchase = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const removeUpdated = iap.purchaseUpdatedListener((event) => {
        const row = event as unknown as Record<string, unknown>;
        const eventProductId = String(row.productId ?? row.id ?? '');
        // Ignore subscription renewals / other SKUs while waiting for this pack.
        if (eventProductId && eventProductId !== pack.productId) {
          return;
        }
        removeUpdated.remove();
        removeError.remove();
        resolve(row);
      });
      const removeError = iap.purchaseErrorListener((error) => {
        removeUpdated.remove();
        removeError.remove();
        reject(rejectPurchaseError(error));
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
          reject(rejectPurchaseError(error));
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

    // Credits already granted — finish is bookkeeping. Never reverse a good grant
    // into a "purchase failed" alert (that invites a second charge).
    try {
      await finishPurchaseWithRetry(iap, purchase, true);
    } catch (finishError) {
      console.warn(
        'purchaseTokens finish after grant',
        formatUnknownError(finishError, 'finishTransaction failed')
      );
    }
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
      const found = await readStoreKitSubscription(iap);
      if (!found) return persistEntitlement(EMPTY_ENTITLEMENT);
      lastStoreKitPurchase = found.purchase;
      return persistEntitlement(found.state);
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
    const m = IAP_SUBSCRIPTIONS.monthly.priceUsd.toFixed(2);
    const y = IAP_SUBSCRIPTIONS.yearly.priceUsd.toFixed(2);
    return `Start a ${BILLING_TRIAL_DAYS}-day free trial — then $${m}/mo or $${y}/yr (${IAP_SUBSCRIPTIONS.yearly.savingsLabel}).`;
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
