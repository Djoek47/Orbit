/**
 * Close Settings / nested modals, then land on the tab root.
 *
 * Settings is an Expo Router modal. Replacing to `/(tabs)` from a child modal
 * (e.g. delete-household) can leave Settings still presented — and if the
 * Poppins voice wheel left `wheelDragging` true, that overlay eats all touches.
 */

export type ModalNav = {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
  replace: (href: '/(tabs)') => void;
};

export function leaveModalsToTabs(nav: ModalNav): void {
  try {
    if (nav.canDismiss?.()) {
      nav.dismissAll?.();
    }
  } catch {
    /* nothing to dismiss */
  }
  try {
    nav.replace('/(tabs)');
  } catch (error) {
    console.warn('leaveModalsToTabs.replace', error);
  }
}
