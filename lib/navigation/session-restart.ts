import { bumpSessionEpoch } from '@/lib/navigation/session-epoch';

/** Cold-start entry. `index` then sends unsigned users to Get Started. */
export const SESSION_RESTART_ROUTE = '/' as const;

/**
 * Dismiss Settings / replace `/` after voice native close.
 * Must stay above `VOICE_NATIVE_CLOSE_MS` (120). IPA 49 remounted at 160ms.
 */
export const SESSION_NAV_DELAY_MS = 400;

/**
 * Remount the root Stack after TurboModule voids + Reanimated unmounts settle.
 * Thread 15 in B88D6E93 was `convertNSExceptionToJSError` during remount.
 */
export const SESSION_REMOUNT_DELAY_MS = 900;

export type RestartNav = {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
  replace: (href: typeof SESSION_RESTART_ROUTE | '/welcome') => void;
};

export type RestartScheduler = (fn: () => void, ms: number) => void;

/**
 * Land on Get Started without remounting the JS tree. Settings is a modal, so
 * `replace('/')` alone can leave Get Started under a still-open overlay —
 * dismiss first, then replace. Epoch remount happens later.
 */
export function applySignedOutNavigation(nav: RestartNav): void {
  try {
    if (nav.canDismiss?.()) {
      nav.dismissAll?.();
    }
  } catch {
    /* nothing to dismiss */
  }
  try {
    nav.replace(SESSION_RESTART_ROUTE);
  } catch {
    try {
      nav.replace('/welcome');
    } catch {
      /* remount still lands index → welcome */
    }
  }
}

/** Remount only the root navigator — not `OrbitProvider` (store already cleared). */
export function remountSignedOutSession(): number {
  return bumpSessionEpoch();
}

/**
 * After sign-out or account deletion, land on Get Started with no leftover
 * household screens underneath.
 *
 * 1. Dismiss Settings/Delete modals.
 * 2. Replace the URL with `/` (same as a process restart).
 * 3. Bump the session epoch so `app/_layout.tsx` remounts the Stack.
 *
 * Production sign-out uses `scheduleSignedOutRestart` so step 3 is not in the
 * same turn as dismiss/replace (IPA 49 Hermes SIGSEGV).
 */
export function restartSignedOutSession(nav: RestartNav): number {
  applySignedOutNavigation(nav);
  return remountSignedOutSession();
}

/**
 * Navigate first, remount later. Reanimated worklets + a live WebRTC close
 * racing `bumpSessionEpoch()` is TestFlight 49 `B88D6E93`.
 */
export function scheduleSignedOutRestart(
  nav: RestartNav,
  schedule: RestartScheduler = (fn, ms) => {
    setTimeout(fn, ms);
  },
): void {
  schedule(() => applySignedOutNavigation(nav), SESSION_NAV_DELAY_MS);
  schedule(() => {
    remountSignedOutSession();
  }, SESSION_REMOUNT_DELAY_MS);
}
