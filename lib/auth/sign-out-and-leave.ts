/**
 * One-shot sign-out + leave Get Started.
 *
 * Settings is an Expo Router modal; confirm uses a RN Modal. Starting
 * router.dismissAll while that alert is still dismissing freezes iOS /
 * eats the first press. Callers must invoke this only after the alert
 * Modal has fully dismissed (orbitAlert defers destructive onPress).
 *
 * Concurrent taps coalesce onto the same in-flight promise so a double
 * press cannot stack two wipes or two restarts.
 *
 * Hard ceiling: if wipe hangs (network), still navigate so the user is
 * never stuck on Settings forever. Overlay stays up through the nav delay
 * so Settings unmount cannot flash Home mid-wipe.
 */

import { SESSION_NAV_DELAY_MS } from '@/lib/navigation/session-restart';

const SIGNOUT_HARD_MS = 12_000;

let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifySignOutListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function isSignOutInFlight(): boolean {
  return inFlight != null;
}

/** Root layout / overlays subscribe so SigningOutOverlay survives Settings unmount. */
export function subscribeSignOutInFlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper — never call from product UI. */
export function resetSignOutInFlightForTests(): void {
  inFlight = null;
  notifySignOutListeners();
}

function withHardCeiling(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn('signOutAndLeave: hard ceiling — navigating anyway');
      resolve();
    }, ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      }
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function signOutAndLeave(signOut: () => Promise<void>): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    notifySignOutListeners();
    try {
      await withHardCeiling(
        (async () => {
          try {
            await signOut();
          } catch (error) {
            console.warn('signOutAndLeave', error);
          }
        })(),
        SIGNOUT_HARD_MS
      );
    } finally {
      try {
        const { resetToGetStarted } = await import('@/lib/navigation/reset-to-get-started');
        resetToGetStarted();
      } catch (navError) {
        console.warn('signOutAndLeave.nav', navError);
      }
      // Hold cover through scheduled dismiss+replace so X / Home cannot re-enter.
      await delay(SESSION_NAV_DELAY_MS + 80);
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
    notifySignOutListeners();
  }
}
