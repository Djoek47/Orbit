/**
 * Close Settings / nested modals and land on the tab root.
 *
 * Settings is an Expo Router `presentation: 'modal'`. Calling `replace('/(tabs)')`
 * while the modal is still in the stack can leave an invisible presentation
 * layer that eats every tap on Home. Prefer dismiss-only when a modal can
 * dismiss — tabs are already underneath.
 */

export type ModalNav = {
  canDismiss?: () => boolean;
  dismiss?: () => void;
  dismissAll?: () => void;
  canGoBack?: () => boolean;
  back?: () => void;
  replace: (href: '/(tabs)') => void;
};

export function leaveModalsToTabs(nav: ModalNav): void {
  try {
    if (nav.canDismiss?.()) {
      // Prefer a single dismiss (Settings alone) over dismissAll+replace.
      // dismissAll + replace is what left a transparent touch-blocker on iOS.
      try {
        if (nav.dismiss) {
          nav.dismiss();
          return;
        }
      } catch {
        /* fall through */
      }
      try {
        nav.dismissAll?.();
        return;
      } catch {
        /* fall through to replace */
      }
    }
  } catch {
    /* nothing to dismiss */
  }

  try {
    if (nav.canGoBack?.()) {
      nav.back?.();
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    nav.replace('/(tabs)');
  } catch (error) {
    console.warn('leaveModalsToTabs.replace', error);
  }
}
