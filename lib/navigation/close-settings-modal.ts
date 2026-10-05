/**
 * Close the Settings Expo Router modal without leaving a touch-blocking shell.
 *
 * Prefer `router.dismiss()` — Settings sits on top of tabs, so dismissing it
 * reveals Home. Never `replace('/(tabs)')` while the modal can still dismiss:
 * that remount path left an invisible iOS modal layer that ate every tap.
 */
import { router } from 'expo-router';

import { leaveModalsToTabs } from '@/lib/navigation/leave-modals-to-tabs';

export function closeSettingsModal(): void {
  leaveModalsToTabs({
    canDismiss: () => {
      try {
        return Boolean(router.canDismiss());
      } catch {
        return false;
      }
    },
    dismiss: () => {
      router.dismiss();
    },
    dismissAll: () => {
      router.dismissAll();
    },
    canGoBack: () => {
      try {
        return Boolean(router.canGoBack());
      } catch {
        return false;
      }
    },
    back: () => {
      router.back();
    },
    replace: (href) => {
      router.replace(href as never);
    },
  });
}
