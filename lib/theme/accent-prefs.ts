import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_ACCENT_THEME_ID, type AccentThemeId } from '@/constants/accent-themes';

const KEY = '@orbit/accent_theme';

export async function loadAccentThemeId(
  householdId: string | null | undefined
): Promise<AccentThemeId> {
  if (!householdId) {
    return DEFAULT_ACCENT_THEME_ID;
  }
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    if (raw === 'ocean' || raw === 'aurora' || raw === 'cosmic' || raw === 'sunset' || raw === 'rose') {
      return raw;
    }
    return DEFAULT_ACCENT_THEME_ID;
  } catch {
    return DEFAULT_ACCENT_THEME_ID;
  }
}

export async function saveAccentThemeId(
  householdId: string | null | undefined,
  themeId: AccentThemeId
) {
  if (!householdId) {
    return;
  }
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, themeId);
  } catch (error) {
    console.warn('saveAccentThemeId failed', error);
  }
}
