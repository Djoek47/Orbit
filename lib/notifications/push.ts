import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dataMode } from '@/config/data-mode';
import { registerIuiActNotificationCategory } from '@/lib/notifications/iui-act-category';
import { openSystemNotificationSettings } from '@/lib/notifications/open-settings-safe';
import { getExpoPushToken, isGranted, requestNotificationPermission } from '@/lib/notifications/push-token';
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

export async function registerForPushNotifications(userId?: string | null) {
  await registerIuiActNotificationCategory();
  const token = await getExpoPushToken();
  if (!token) return null;

  if (dataMode === 'supabase' && userId) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          member_id: null,
          token,
          platform: Platform.OS,
        },
        { onConflict: 'token,member_id' }
      );
      if (error) {
        console.warn('Failed to persist push token', error.message);
      }
    }
  }

  return token;
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
  opts?: { categoryIdentifier?: string }
) {
  const permission = await Notifications.getPermissionsAsync();
  if (!isGranted(permission)) {
    return null;
  }
  return Notifications.scheduleNotificationAsync({
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
