import { bumpSessionEpoch } from '@/lib/navigation/session-epoch';

/** Cold-start entry. `index` then sends unsigned users to Get Started. */
export const SESSION_RESTART_ROUTE = '/' as const;

export type RestartNav = {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
  replace: (href: typeof SESSION_RESTART_ROUTE | '/welcome') => void;
};

/**
 * After sign-out or account deletion, land on Get Started with no leftover
 * household screens underneath. `replace('/welcome')` from a Settings/Delete
 * modal only stacks a new window on the still-mounted tabs.
 *
 * 1. Dismiss Settings/Delete modals.
 * 2. Replace the URL with `/` (same as a process restart).
 * 3. Bump the session epoch so `app/_layout.tsx` remounts the tree.
 */
export function restartSignedOutSession(nav: RestartNav): number {
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
  return bumpSessionEpoch();
}
