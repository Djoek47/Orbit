import { Platform } from 'react-native';

import type { ColorPaletteId } from '@/constants/color-palettes';

/** PascalCase names registered in app.json expo-alternate-app-icons plugin. */
export type AlternateIconName =
  | 'Sky'
  | 'Citrus'
  | 'Coral'
  | 'Berry'
  | 'SkyHalloween'
  | 'CitrusHalloween'
  | 'CoralHalloween'
  | 'BerryHalloween';

const PALETTE_TO_ICON: Record<ColorPaletteId, AlternateIconName | null> = {
  sky: 'Sky',
  citrus: 'Citrus',
  /** Default primary icon is coral — reset to system default. */
  coral: null,
  berry: 'Berry',
};

/**
 * Switch the home-screen icon to match the user's palette.
 * No-op on web / Expo Go / when the native module is unavailable.
 */
/** Same palette, witch hat on the roof — used while the Halloween theme is on. */
const HALLOWEEN_ICON: Record<ColorPaletteId, AlternateIconName> = {
  sky: 'SkyHalloween',
  citrus: 'CitrusHalloween',
  coral: 'CoralHalloween',
  berry: 'BerryHalloween',
};

export async function syncHomeScreenIcon(paletteId: ColorPaletteId, halloween = false): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }

  try {
    const mod = await import('expo-alternate-app-icons');
    if (!mod.supportsAlternateIcons) {
      return;
    }
    const name = halloween ? HALLOWEEN_ICON[paletteId] : (PALETTE_TO_ICON[paletteId] ?? null);
    // iOS shows an alert on every change, so only switch when the icon is actually different.
    if ((mod.getAppIconName?.() ?? null) === name) return;
    await mod.setAlternateAppIcon(name);
  } catch {
    // Expo Go and builds without the native module — ignore.
  }
}

/**
 * Seasonal pass, safe to run on every launch: puts the Halloween icon on while the theme is
 * on, and takes it off once it's off (or the season is over). Never touches a normal icon.
 */
export async function syncSeasonalIcon(paletteId: ColorPaletteId, halloween: boolean): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const mod = await import('expo-alternate-app-icons');
    if (!mod.supportsAlternateIcons) return;
    const current = String(mod.getAppIconName?.() ?? '');
    if (halloween || current.endsWith('Halloween')) await syncHomeScreenIcon(paletteId, halloween);
  } catch {
    /* Expo Go */
  }
}
