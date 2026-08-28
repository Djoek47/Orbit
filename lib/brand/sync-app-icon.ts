import { Platform } from 'react-native';

import type { ColorPaletteId } from '@/constants/color-palettes';

/** PascalCase names registered in app.json expo-alternate-app-icons plugin. */
export type AlternateIconName = 'Sky' | 'Citrus' | 'Coral' | 'Berry';

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
export async function syncHomeScreenIcon(paletteId: ColorPaletteId): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }

  try {
    const mod = await import('expo-alternate-app-icons');
    if (!mod.supportsAlternateIcons) {
      return;
    }
    const name = PALETTE_TO_ICON[paletteId] ?? null;
    await mod.setAlternateAppIcon(name);
  } catch {
    // Expo Go and builds without the native module — ignore.
  }
}
