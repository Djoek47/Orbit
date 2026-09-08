/**
 * Per-household accent overrides so switching homes is visually obvious.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AccentThemeId } from '@/constants/accent-themes';
import { ACCENT_THEMES, DEFAULT_ACCENT_THEME_ID } from '@/constants/accent-themes';

const KEY = '@orbit/householdAccentPrefs';

type AccentPrefs = Record<string, AccentThemeId>;

const THEME_IDS = new Set(ACCENT_THEMES.map((theme) => theme.id));

function hashHouseholdId(id: string): AccentThemeId {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) {
    sum += id.charCodeAt(i);
  }
  const themes = ACCENT_THEMES.map((theme) => theme.id);
  return themes[sum % themes.length] ?? DEFAULT_ACCENT_THEME_ID;
}

async function readAll(): Promise<AccentPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AccentPrefs;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getHouseholdAccentPref(householdId: string | null | undefined): Promise<AccentThemeId | null> {
  if (!householdId?.trim()) return null;
  const all = await readAll();
  const stored = all[householdId];
  if (stored && THEME_IDS.has(stored)) return stored;
  return hashHouseholdId(householdId);
}

export async function setHouseholdAccentPref(
  householdId: string,
  accentThemeId: AccentThemeId
): Promise<void> {
  if (!householdId.trim() || !THEME_IDS.has(accentThemeId)) return;
  const all = await readAll();
  all[householdId] = accentThemeId;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch (error) {
    console.warn('setHouseholdAccentPref failed', error);
  }
}
