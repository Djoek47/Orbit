import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Shared permission + Expo push token acquisition for auth and Sidekick flows. */
export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (isGranted(existing)) return true;

  const permission = await Notifications.requestPermissionsAsync();
  return isGranted(permission);
}

export function isGranted(permission: Notifications.NotificationPermissionsStatus) {
  const value = permission as unknown as { granted?: boolean; status?: string };
  return value.granted === true || value.status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const granted = await requestNotificationPermission();
  if (!granted) return null;

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

  return tokenResponse.data ?? null;
}
