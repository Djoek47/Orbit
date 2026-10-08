import { bumpSessionEpoch } from '@/lib/navigation/session-epoch';

/**
 * Get Started (welcome). Go here directly on sign-out.
 * Do **not** land on `/` alone — `(tabs)` returns null when signed out and a
 * failed/slow index handoff leaves a blank dark screen (TF 111).
 */
export const SESSION_RESTART_ROUTE = '/welcome' as const;

/**
 * Dismiss Settings / replace Get Started after voice native close.
 * Must stay above `VOICE_NATIVE_CLOSE_MS` (120).
 */
export const SESSION_NAV_DELAY_MS = 400;

/**
 * IPA 50 remounted the Stack here and login/create then SIGSEGVd (`08497FBD`).
 * Kept as a named constant so tests prove we do **not** schedule it anymore.
 */
export const SESSION_REMOUNT_DELAY_MS = 900;

export type RestartNav = {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
  /** Prefer this when available — dismisses modals and lands href (or replaces). */
  dismissTo?: (href: typeof SESSION_RESTART_ROUTE | '/welcome') => void;
  replace: (href: typeof SESSION_RESTART_ROUTE | '/' | '/welcome') => void;
};

export type RestartScheduler = (fn: () => void, ms: number) => unknown;

type Cancel = () => void;

const pendingCancels: Cancel[] = [];

export function cancelSignedOutRestart(): void {
  while (pendingCancels.length) {
    try {
      pendingCancels.pop()?.();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Land on Get Started without remounting the JS tree. Settings is a modal, so
 * `dismissAll` + `replace` can race and leave `(tabs)` rendering null (blank).
 * Prefer `dismissTo('/welcome')` (one hop). Do **not** bump session epoch (IPA 50).
 */
export function applySignedOutNavigation(nav: RestartNav): void {
  if (nav.dismissTo) {
    try {
      nav.dismissTo('/welcome');
      return;
    } catch {
      /* fall through to dismissAll + replace */
    }
  }
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
      nav.replace('/');
    } catch {
      /* last resort — tabs safety net also replaces /welcome */
    }
  }
}

/** Manual remount only — not used on the sign-out timer (login crash). */
export function remountSignedOutSession(): number {
  return bumpSessionEpoch();
}

export function restartSignedOutSession(nav: RestartNav): void {
  applySignedOutNavigation(nav);
}

/**
 * Dismiss + replace after native voice settle. No Stack remount — IPA 50
 * `08497FBD` died in Hermes Object.hasOwnProperty / Array.map on login/create
 * after that remount, with WebRTC still live.
 */
export function scheduleSignedOutRestart(
  nav: RestartNav,
  schedule: RestartScheduler = (fn, ms) => setTimeout(fn, ms),
  unschedule: (handle: unknown) => void = (handle) => {
    if (typeof handle === 'number' || typeof handle === 'object') {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
  },
): void {
  cancelSignedOutRestart();
  const handle = schedule(() => applySignedOutNavigation(nav), SESSION_NAV_DELAY_MS);
  pendingCancels.push(() => {
    try {
      unschedule(handle);
    } catch {
      /* ignore */
    }
  });
}
