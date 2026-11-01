/**
 * Holiday settings on this phone: which regions, which days. The first time, regions are
 * guessed from the phone's locale (en-CA → Global + Canada; fr-CA adds Québec).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import {
  DEFAULT_HOLIDAY_PREFS,
  suggestedRegions,
  type HolidayPrefs,
} from '@/lib/calendar/holidays';

const KEY = '@orbit/holiday_prefs_v1';

let current: HolidayPrefs | null = null;
const listeners = new Set<(p: HolidayPrefs) => void>();

function localeGuess(): HolidayPrefs {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const [lang, region] = locale.split(/[-_]/);
    return { ...DEFAULT_HOLIDAY_PREFS, regions: suggestedRegions(region, lang) };
  } catch {
    return DEFAULT_HOLIDAY_PREFS;
  }
}

export async function loadHolidayPrefs(): Promise<HolidayPrefs> {
  if (current) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HolidayPrefs>;
      current = {
        enabled: parsed.enabled !== false,
        regions: Array.isArray(parsed.regions) && parsed.regions.length ? parsed.regions : ['global'],
        overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      };
      if (!current.regions.includes('global')) current.regions = ['global', ...current.regions];
      return current;
    }
  } catch {
    /* fall through to the guess */
  }
  current = localeGuess();
  return current;
}

export async function saveHolidayPrefs(next: HolidayPrefs): Promise<void> {
  current = { ...next, regions: next.regions.includes('global') ? next.regions : ['global', ...next.regions] };
  listeners.forEach((fn) => fn(current!));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch (error) {
    console.warn('saveHolidayPrefs', error);
  }
}

/** Live holiday settings; every screen using it updates when Settings changes them. */
export function useHolidayPrefs(): HolidayPrefs {
  const [prefs, setPrefs] = useState<HolidayPrefs>(current ?? DEFAULT_HOLIDAY_PREFS);
  useEffect(() => {
    let alive = true;
    void loadHolidayPrefs().then((p) => alive && setPrefs(p));
    listeners.add(setPrefs);
    return () => {
      alive = false;
      listeners.delete(setPrefs);
    };
  }, []);
  return prefs;
}
