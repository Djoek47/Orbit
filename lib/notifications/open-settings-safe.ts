import * as Linking from 'expo-linking';
import { InteractionManager, Platform } from 'react-native';

/** iOS needs a beat after scroll/Reanimated layout before leaving the app. */
const IOS_SETTLE_MS = 200;

let openingSettings = false;

/** Wait for in-flight gestures/animations before handing off to Settings. */
export function waitBeforeOpeningExternalSettings(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, Platform.OS === 'ios' ? IOS_SETTLE_MS : 0);
      });
    });
  });
}

/**
 * Open the app's page in system Settings (notification toggles live there on iOS).
 * Deferred on iOS to avoid a Fabric/Reanimated clip crash when backgrounding mid-layout.
 */
export async function openSystemNotificationSettings(): Promise<boolean> {
  if (openingSettings) return false;
  openingSettings = true;
  try {
    await waitBeforeOpeningExternalSettings();
    await Linking.openSettings();
    return true;
  } catch (error) {
    console.warn('openSystemNotificationSettings failed', error);
    return false;
  } finally {
    setTimeout(() => {
      openingSettings = false;
    }, 1500);
  }
}
