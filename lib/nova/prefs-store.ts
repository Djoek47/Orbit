import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_NOVA_NOTIFICATION_PREFS } from '@/services/nova-notifications';
import type { NovaNotificationPrefs } from '@/types/orbit';

const KEY = '@orbit/nova_notification_prefs';

export async function loadNovaNotificationPrefs(
  householdId: string | null | undefined
): Promise<NovaNotificationPrefs> {
  if (!householdId) {
    return { ...DEFAULT_NOVA_NOTIFICATION_PREFS };
  }
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) {
      return { ...DEFAULT_NOVA_NOTIFICATION_PREFS };
    }
    return { ...DEFAULT_NOVA_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOVA_NOTIFICATION_PREFS };
  }
}

export async function saveNovaNotificationPrefs(
  householdId: string | null | undefined,
  prefs: NovaNotificationPrefs
) {
  if (!householdId) {
    return;
  }
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify(prefs));
  } catch (error) {
    console.warn('saveNovaNotificationPrefs failed', error);
  }
}
