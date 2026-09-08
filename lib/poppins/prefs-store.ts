import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_POPPINS_NOTIFICATION_PREFS } from '@/services/poppins-notifications';
import type { PoppinsNotificationPrefs } from '@/types/orbit';

const KEY = '@orbit/poppins_notification_prefs';

export async function loadPoppinsNotificationPrefs(
  householdId: string | null | undefined
): Promise<PoppinsNotificationPrefs> {
  if (!householdId) {
    return { ...DEFAULT_POPPINS_NOTIFICATION_PREFS };
  }
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (!raw) {
      return { ...DEFAULT_POPPINS_NOTIFICATION_PREFS };
    }
    return { ...DEFAULT_POPPINS_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_POPPINS_NOTIFICATION_PREFS };
  }
}

export async function savePoppinsNotificationPrefs(
  householdId: string | null | undefined,
  prefs: PoppinsNotificationPrefs
) {
  if (!householdId) {
    return;
  }
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, JSON.stringify(prefs));
  } catch (error) {
    console.warn('savePoppinsNotificationPrefs failed', error);
  }
}
