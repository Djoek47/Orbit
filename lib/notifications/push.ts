import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dataMode } from '@/config/data-mode';
import { registerIuiActNotificationCategory } from '@/lib/notifications/iui-act-category';
import { openSystemNotificationSettings } from '@/lib/notifications/open-settings-safe';
import { getExpoPushTokenDetailed, isGranted, requestNotificationPermission } from '@/lib/notifications/push-token';
import { getSupabaseClient } from '@/lib/supabase/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Save this phone's push token for the signed-in person. Runs on every sign-in and every time
 * the app comes to the front, so a token that changed (reinstall, restore) is picked up.
 * When the phone can't give a token, the reason is recorded server-side
 * (push_registration_problems) instead of disappearing into a console warning.
 */
export async function registerForPushNotifications(userId?: string | null) {
  await registerIuiActNotificationCategory();
  const result = await getExpoPushTokenDetailed();

  if (dataMode !== 'supabase' || !userId) return result.token;
  const supabase = getSupabaseClient();
  if (!supabase) return result.token;

  if (!result.token) {
    await supabase
      .rpc('report_push_problem', {
        p_reason: result.reason ?? 'unknown',
        p_platform: Platform.OS,
        p_app_version: Constants.expoConfig?.version ?? null,
      })
      .then(undefined, () => undefined);
    return null;
  }

  const { error } = await supabase.rpc('register_push_token', {
    p_token: result.token,
    p_platform: Platform.OS,
  });
  if (error) {
    console.warn('Failed to persist push token', error.message);
    await supabase
      .rpc('report_push_problem', {
        p_reason: `save_failed: ${error.message}`,
        p_platform: Platform.OS,
        p_app_version: Constants.expoConfig?.version ?? null,
      })
      .then(undefined, () => undefined);
  }
  return result.token;
}

export async function scheduleLocalReminder(title: string, body: string, secondsFromNow = 60) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, secondsFromNow),
    },
  });
}

/** Immediate OS banner + lock-screen notification (not silent inbox-only). */
export async function presentLocalBanner(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  opts?: { categoryIdentifier?: string; identifier?: string }
) {
  const permission = await Notifications.getPermissionsAsync();
  if (!isGranted(permission)) {
    return null;
  }
  return Notifications.scheduleNotificationAsync({
    identifier: opts?.identifier,
    content: {
      title,
      body,
      sound: true,
      data: data ?? {},
      ...(opts?.categoryIdentifier ? { categoryIdentifier: opts.categoryIdentifier } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
}

export async function syncAppBadge(count: number) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(count)));
  } catch {
    // Badge unsupported on some platforms / Expo Go builds.
  }
}

/** Clear banners sitting in the OS notification tray (ghost lock-screen alerts). */
export async function clearPresentedNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Unsupported on some platforms / Expo Go builds.
  }
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // ignore
  }
}

export async function getNotificationPermissionStatus() {
  return Notifications.getPermissionsAsync();
}

export { openSystemNotificationSettings } from '@/lib/notifications/open-settings-safe';
export { isGranted as isNotificationPermissionGranted, requestNotificationPermission };
