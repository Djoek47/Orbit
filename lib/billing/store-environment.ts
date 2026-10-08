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

export function useShowBillingDiagnostics(): boolean {
  const [show, setShow] = useState(() => typeof __DEV__ !== 'undefined' && __DEV__);
  useEffect(() => {
    let cancelled = false;
    void getStoreEnvironment().then((env) => {
      if (!cancelled) setShow(showBillingDiagnostics(env));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return show;
}
