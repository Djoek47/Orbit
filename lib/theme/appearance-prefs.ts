import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import {
  DEFAULT_BACKGROUND_THEME_ID,
  getBackgroundTheme,
  isBackgroundThemeId,
  type BackgroundThemeId,
} from '@/constants/background-themes';
import {
  DEFAULT_COLOR_PALETTE_ID,
  getColorPalette,
  isColorPaletteId,
  resolveThemeFromPalette,
  type ColorPaletteId,
} from '@/constants/color-palettes';
import { choremaxxBrand } from '@/constants/choremaxx-brand';
import type { OrbitColorPalette } from '@/constants/orbit-theme';
import {
  isAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';

export type AppearanceMode = 'dark' | 'light' | 'system';

const APPEARANCE_KEY = '@orbit/appearance_mode';
const BACKGROUND_KEY = '@orbit/background_theme';
const MEMBER_BG_KEY = '@orbit/member_background_theme';
const PALETTE_KEY = '@orbit/color_palette';
const MEMBER_PALETTE_KEY = '@orbit/member_color_palette';
const MAPS_APP_KEY = '@orbit/preferred_maps_app';
/** Legacy accent keys — migrated into palette once. */
const LEGACY_ACCENT_HH = '@orbit/accent_theme';
const LEGACY_ACCENT_MEMBER = '@orbit/member_accent_theme';

export type PreferredMapsApp = 'auto' | 'apple' | 'google' | 'waze';

export function isAppearanceMode(value: string | null | undefined): value is AppearanceMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function isPreferredMapsApp(value: string | null | undefined): value is PreferredMapsApp {
  return value === 'auto' || value === 'apple' || value === 'google' || value === 'waze';
}

export async function loadAppearanceMode(): Promise<AppearanceMode> {
  try {
    const raw = await AsyncStorage.getItem(APPEARANCE_KEY);
    return isAppearanceMode(raw) ? raw : 'dark';
  } catch {
    return 'dark';
  }
}

export async function saveAppearanceMode(mode: AppearanceMode): Promise<void> {
  try {
    await AsyncStorage.setItem(APPEARANCE_KEY, mode);
  } catch (error) {
    console.warn('saveAppearanceMode failed', error);
  }
}

export async function loadBackgroundThemeId(
  householdId: string | null | undefined,
  memberId?: string | null
): Promise<BackgroundThemeId> {
  try {
    if (householdId && memberId) {
      const memberRaw = await AsyncStorage.getItem(`${MEMBER_BG_KEY}:${householdId}:${memberId}`);
      if (isBackgroundThemeId(memberRaw)) return memberRaw;
    }
    if (householdId) {
      const hhRaw = await AsyncStorage.getItem(`${BACKGROUND_KEY}:${householdId}`);
      if (isBackgroundThemeId(hhRaw)) return hhRaw;
    }
    return DEFAULT_BACKGROUND_THEME_ID;
  } catch {
    return DEFAULT_BACKGROUND_THEME_ID;
  }
}

export async function saveBackgroundThemeId(
  householdId: string | null | undefined,
  memberId: string | null | undefined,
  themeId: BackgroundThemeId
): Promise<void> {
  if (!householdId) return;
  try {
    if (memberId) {
      await AsyncStorage.setItem(`${MEMBER_BG_KEY}:${householdId}:${memberId}`, themeId);
    }
    await AsyncStorage.setItem(`${BACKGROUND_KEY}:${householdId}`, themeId);
  } catch (error) {
    console.warn('saveBackgroundThemeId failed', error);
  }
}

/** Load unified palette id (migrates legacy accent theme when missing). */
export async function loadPaletteId(
  householdId: string | null | undefined,
  memberId?: string | null
): Promise<ColorPaletteId> {
  try {
    if (householdId && memberId) {
      const memberRaw = await AsyncStorage.getItem(`${MEMBER_PALETTE_KEY}:${householdId}:${memberId}`);
      if (isColorPaletteId(memberRaw)) return memberRaw;
      const legacyMember = await AsyncStorage.getItem(`${LEGACY_ACCENT_MEMBER}:${householdId}:${memberId}`);
      if (isAccentThemeId(legacyMember)) {
        await AsyncStorage.setItem(`${MEMBER_PALETTE_KEY}:${householdId}:${memberId}`, legacyMember);
        return legacyMember;
      }
    }
    if (householdId) {
      const hhRaw = await AsyncStorage.getItem(`${PALETTE_KEY}:${householdId}`);
      if (isColorPaletteId(hhRaw)) return hhRaw;
      const legacyHh = await AsyncStorage.getItem(`${LEGACY_ACCENT_HH}:${householdId}`);
      if (isAccentThemeId(legacyHh)) {
        await AsyncStorage.setItem(`${PALETTE_KEY}:${householdId}`, legacyHh);
        return legacyHh;
      }
    }
    return DEFAULT_COLOR_PALETTE_ID;
  } catch {
    return DEFAULT_COLOR_PALETTE_ID;
  }
}

export async function savePaletteId(
  householdId: string | null | undefined,
  memberId: string | null | undefined,
  paletteId: ColorPaletteId
): Promise<void> {
  if (!householdId) return;
  try {
    if (memberId) {
      await AsyncStorage.setItem(`${MEMBER_PALETTE_KEY}:${householdId}:${memberId}`, paletteId);
      await AsyncStorage.setItem(`${LEGACY_ACCENT_MEMBER}:${householdId}:${memberId}`, paletteId);
    }
    await AsyncStorage.setItem(`${PALETTE_KEY}:${householdId}`, paletteId);
    await AsyncStorage.setItem(`${LEGACY_ACCENT_HH}:${householdId}`, paletteId);
  } catch (error) {
    console.warn('savePaletteId failed', error);
  }
}

export async function loadPreferredMapsApp(): Promise<PreferredMapsApp> {
  try {
    const raw = await AsyncStorage.getItem(MAPS_APP_KEY);
    return isPreferredMapsApp(raw) ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

export async function savePreferredMapsApp(app: PreferredMapsApp): Promise<void> {
  try {
    await AsyncStorage.setItem(MAPS_APP_KEY, app);
  } catch (error) {
    console.warn('savePreferredMapsApp failed', error);
  }
}

export function resolveIsDark(mode: AppearanceMode): boolean {
  if (mode === 'system') {
    return Appearance.getColorScheme() !== 'light';
  }
  return mode !== 'light';
}

/**
 * Unified theme resolver: palette + day/night/system.
 * Accent primary/secondary are folded into the palette.
 */
export function resolveTheme(
  mode: AppearanceMode,
  paletteId: ColorPaletteId | string | null | undefined,
  systemScheme?: 'light' | 'dark' | null
): OrbitColorPalette & { isDark: boolean } {
  const scheme =
    systemScheme ?? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
  const isDark =
    mode === 'system' ? scheme !== 'light' : mode !== 'light';
  const resolved = resolveThemeFromPalette(paletteId, isDark);
  const { accentTheme: _accent, ...palette } = resolved;
  return palette;
}

/** @deprecated Prefer resolveTheme(paletteId). Kept for transitional call sites. */
export function resolveOrbitPalette(
  mode: AppearanceMode,
  backgroundThemeId: BackgroundThemeId
): OrbitColorPalette & { isDark: boolean } {
  const isDark = resolveIsDark(mode);
  const pack = getBackgroundTheme(backgroundThemeId);
  const usePack =
    mode === 'system'
      ? getBackgroundTheme(
          isDark
            ? pack.base === 'dark'
              ? pack.id
              : 'midnight'
            : pack.base === 'light'
              ? pack.id
              : 'mist'
        )
      : pack;

  const effectiveDark = mode === 'system' ? isDark : usePack.base === 'dark';

  return {
    background: usePack.background,
    backgroundSoft: usePack.backgroundSoft,
    shell: usePack.shell,
    card: usePack.card,
    cardStrong: usePack.cardStrong,
    cardMuted: effectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    border: usePack.border,
    borderStrong: effectiveDark ? 'rgba(89, 178, 225, 0.35)' : 'rgba(59, 130, 246, 0.35)',
    text: usePack.text,
    textSoft: usePack.textSoft,
    textMuted: usePack.textMuted,
    textSubtle: usePack.textSubtle,
    textFaint: usePack.textFaint,
    tabInactive: usePack.tabInactive,
    orbitBlue: choremaxxBrand.cyan,
    orbitBlueDeep: '#3A9BC8',
    orbitBlueDark: '#2B6F94',
    primary: choremaxxBrand.cyan,
    accent: choremaxxBrand.mint,
    rewardsGold: choremaxxBrand.gold,
    novaCyan: '#06B6D4',
    success: '#34D399',
    warning: '#FB923C',
    danger: '#F87171',
    planPurple: '#A78BFA',
    rankGold: '#FBBF24',
    ink: usePack.ink,
    brandSlate: choremaxxBrand.slate,
    brandFaded: choremaxxBrand.faded,
    isDark: effectiveDark,
  };
}

/** Map a legacy AccentThemeId onto ColorPaletteId (identity). */
export function accentIdAsPaletteId(id: AccentThemeId): ColorPaletteId {
  return isColorPaletteId(id) ? id : DEFAULT_COLOR_PALETTE_ID;
}

export { getColorPalette };
