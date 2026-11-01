import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_POPPINS_NOTIFICATION_PREFS } from '@/services/poppins-notifications';
import type { PoppinsNotificationPrefs } from '@/types/orbit';

const KEY = '@orbit/poppins_notification_prefs';

function isPrefsObject(
  value: Partial<PoppinsNotificationPrefs> | null | undefined
): value is Partial<PoppinsNotificationPrefs> {
  return value != null && typeof value === 'object' && Object.keys(value as object).length > 0;
}

/**
 * Server-first merge. Local AsyncStorage is only a cache when the household
 * row has no notification_prefs yet — never overlay phone defaults on top of
 * another device's saved toggles.
 */
export function mergeNotificationPrefs(input: {
  server?: Partial<PoppinsNotificationPrefs> | null;
  local?: Partial<PoppinsNotificationPrefs> | null;
}): PoppinsNotificationPrefs {
  if (isPrefsObject(input.server)) {
    return { ...DEFAULT_POPPINS_NOTIFICATION_PREFS, ...input.server };
  }
  return { ...DEFAULT_POPPINS_NOTIFICATION_PREFS, ...(input.local ?? {}) };
}

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

  try {
    const { dataMode } = await import('@/config/data-mode');
    if (dataMode !== 'supabase') return;
    const { getSupabaseClient } = await import('@/lib/supabase/client');
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .from('households')
      .update({ notification_prefs: prefs } as never)
      .eq('id', householdId);
    if (error) console.warn('savePoppinsNotificationPrefs supabase', error.message);
  } catch (error) {
    console.warn('savePoppinsNotificationPrefs supabase skipped', error);
  }
}
