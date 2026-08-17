import { CommonActions } from '@react-navigation/native';
import { router } from 'expo-router';

type DispatchNav = {
  dispatch: (action: ReturnType<typeof CommonActions.reset>) => void;
  getParent?: () => DispatchNav | undefined;
};

function asNav(value: unknown): DispatchNav | null {
  if (!value || typeof value !== 'object') return null;
  const nav = value as DispatchNav;
  if (typeof nav.dispatch !== 'function') return null;
  return nav;
}

function rootNavigation(navigation?: unknown): DispatchNav | null {
  let current = asNav(navigation);
  if (!current) return null;
  while (typeof current.getParent === 'function') {
    const parent = asNav(current.getParent());
    if (!parent) break;
    current = parent;
  }
  return current;
}

/**
 * After sign-out or account deletion, land on Get Started with no leftover
 * household screens underneath. `replace('/welcome')` from a Settings/Delete
 * modal only stacks a new window on the still-mounted tabs.
 */
export function resetToGetStarted(navigation?: unknown): void {
  const root = rootNavigation(navigation);
  if (root) {
    root.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'welcome' }],
      })
    );
    return;
  }
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace('/welcome');
}
