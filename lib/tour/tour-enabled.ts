/**
 * Remote kill switch for the first-run tour (WO9.3 §3.10).
 * Defaults on. Set EXPO_PUBLIC_TOUR_ENABLED=0 or app_config.tour_enabled=false to kill.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { dataMode } from '@/config/data-mode';

const CACHE_KEY = 'orbit.tour.enabled.v1';

let cached: boolean | null = null;

function envOverride(): boolean | null {
  const raw = process.env.EXPO_PUBLIC_TOUR_ENABLED?.trim();
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return null;
}

export function isTourEnabledSync(): boolean {
  const env = envOverride();
  if (env != null) return env;
  if (cached != null) return cached;
  return true;
}

export async function hydrateTourEnabled(): Promise<boolean> {
  const env = envOverride();
  if (env != null) {
    cached = env;
    return env;
  }

  try {
    const local = await AsyncStorage.getItem(CACHE_KEY);
    if (local === '0') cached = false;
    if (local === '1') cached = true;
  } catch {
    /* ignore */
  }

  if (dataMode === 'supabase') {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase/client');
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'tour_enabled')
          .maybeSingle();
        if (!error && data && typeof (data as { value?: unknown }).value !== 'undefined') {
          const value = (data as { value: unknown }).value;
          const enabled = value !== false && value !== 'false' && value !== 0;
          cached = enabled;
          await AsyncStorage.setItem(CACHE_KEY, enabled ? '1' : '0');
          return enabled;
        }
      }
    } catch (error) {
      console.warn('hydrateTourEnabled', error);
    }
  }

  return isTourEnabledSync();
}
