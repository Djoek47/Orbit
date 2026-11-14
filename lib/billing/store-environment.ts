/**
 * Which App Store this install came from: TestFlight and Xcode builds run in Apple's sandbox,
 * App Store installs in production. Read once from StoreKit's AppTransaction (iOS 16+).
 *
 * Used to keep test-only tools (Purchase diagnostics) out of the version customers download,
 * without a separate build: the same binary goes from TestFlight to the App Store.
 */
import { useEffect, useState } from 'react';

import { isNativeIapAvailable } from '@/lib/billing/iap';

export type StoreEnvironment = 'Production' | 'Sandbox' | 'Xcode' | 'unknown';

let cached: Promise<StoreEnvironment> | null = null;

export function getStoreEnvironment(): Promise<StoreEnvironment> {
  if (cached) return cached;
  cached = (async () => {
    if (!isNativeIapAvailable()) return 'unknown';
    try {
      const iap = await import('expo-iap');
      await iap.initConnection();
      const tx = (await iap.getAppTransactionIOS()) as { environment?: string } | null;
      const env = tx?.environment ?? '';
      if (/production/i.test(env)) return 'Production';
      if (/sandbox/i.test(env)) return 'Sandbox';
      if (/xcode/i.test(env)) return 'Xcode';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  })();
  return cached;
}

/**
 * True only where diagnostics belong: development, TestFlight, Xcode. False for App Store
 * installs — and false while unknown, so a customer never glimpses it.
 */
export function showBillingDiagnostics(env: StoreEnvironment): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  return env === 'Sandbox' || env === 'Xcode';
}

/** Settled environment answer, for synchronous first render once known. */
let settled: StoreEnvironment | null = null;

/**
 * Tri-state: `null` while StoreKit hasn't answered yet, then true/false. Screens must treat
 * `null` as "loading", never as "hidden" — redirecting on the first (unknown) render from inside
 * a modal left an invisible presentation that ate every touch.
 */
export function useBillingDiagnosticsAccess(): boolean | null {
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  const [show, setShow] = useState<boolean | null>(() =>
    dev ? true : settled ? showBillingDiagnostics(settled) : null,
  );
  useEffect(() => {
    if (dev) return;
    let cancelled = false;
    getStoreEnvironment()
      .then((env) => {
        settled = env;
        if (!cancelled) setShow(showBillingDiagnostics(env));
      })
      .catch(() => {
        if (!cancelled) setShow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dev]);
  return show;
}

/** Entry-row visibility: hidden until known (customers never glimpse it). */
export function useShowBillingDiagnostics(): boolean {
  return useBillingDiagnosticsAccess() === true;
}
