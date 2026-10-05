/**
 * Close the Settings Expo Router modal without leaving a touch-blocking shell.
 *
 * `router.back()` alone can leave Settings still presented (especially after
 * Poppins voice-wheel gesture locks). That invisible modal eats every tap on
 * Home / tabs until the app is force-quit.
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
    dismissAll: () => {
      try {
        router.dismissAll();
      } catch {
        /* nothing presented */
      }
    },
    replace: (href) => {
      router.replace(href as never);
    },
  });
}
