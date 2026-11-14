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

export type PushTokenResult = { token: string; reason?: undefined } | { token: null; reason: string };

/**
 * The phone's Expo push token, or the reason there isn't one — so a phone that never gets
 * notifications can be explained instead of failing silently.
 */
export async function getExpoPushTokenDetailed(): Promise<PushTokenResult> {
  if (!Device.isDevice) return { token: null, reason: 'simulator' };

  let granted = false;
  try {
    granted = await requestNotificationPermission();
  } catch (error) {
    return { token: null, reason: `permission_error: ${String(error)}` };
  }
  if (!granted) return { token: null, reason: 'permission_denied' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orbit-default', {
      name: 'Orbit',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
  }

  const projectId =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? undefined;
  if (!projectId || projectId === 'replace-with-eas-project-id') {
    return { token: null, reason: 'missing_eas_project_id' };
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data
      ? { token: tokenResponse.data }
      : { token: null, reason: 'empty_token' };
  } catch (error) {
    // e.g. "no valid aps-environment entitlement" when the build's profile lacks Push.
    return { token: null, reason: `token_error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  return (await getExpoPushTokenDetailed()).token;
}
