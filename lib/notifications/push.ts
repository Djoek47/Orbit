import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dataMode } from '@/config/data-mode';
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

function isGranted(permission: Notifications.NotificationPermissionsStatus) {
  const value = permission as unknown as { granted?: boolean; status?: string };
  return value.granted === true || value.status === 'granted';
}

export async function registerForPushNotifications(userId?: string | null) {
  if (!Device.isDevice) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let permission = existing;
  if (!isGranted(existing)) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!isGranted(permission)) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orbit-default', {
      name: 'Orbit',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? undefined;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId && projectId !== 'replace-with-eas-project-id' ? { projectId } : undefined
  );
  const token = tokenResponse.data;

  if (dataMode === 'supabase' && userId && token) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
        },
        { onConflict: 'token' }
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
