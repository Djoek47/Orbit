/**
 * Unified personalization: one palette id owns day + night surface/font/accent
 * pairs. Logo directions: Sky, Citrus, Coral, Berry.
 */

import type { AccentTheme, AccentThemeId, AccentTypeStyle } from '@/constants/accent-themes';
import {
  ACCENT_THEMES,
  DEFAULT_ACCENT_THEME_ID,
  getAccentTheme,
  LEGACY_ACCENT_TO_PALETTE,
  migrateAccentThemeId,
} from '@/constants/accent-themes';
import type { OrbitColorPalette } from '@/constants/orbit-theme';
import { choremaxxBrand } from '@/constants/choremaxx-brand';

export type ColorPaletteId = AccentThemeId;

export type ColorPaletteSlice = Pick<
  OrbitColorPalette,
  | 'background'
  | 'backgroundSoft'
  | 'shell'
  | 'card'
  | 'cardStrong'
  | 'cardMuted'
  | 'border'
  | 'borderStrong'
  | 'text'
  | 'textSoft'
  | 'textMuted'
  | 'textSubtle'
  | 'textFaint'
  | 'tabInactive'
  | 'ink'
>;

export type ColorPalette = {
  id: ColorPaletteId;
  label: string;
  swatch: { primary: string; secondary: string };
  typeStyle: AccentTypeStyle;
  /** Soft canvas tint for night mode (Make accent.bg). */
  nightTint: string;
  day: ColorPaletteSlice;
  night: ColorPaletteSlice;
};

const MIDNIGHT: ColorPaletteSlice = {
  background: '#070D1C',
  backgroundSoft: '#0A1525',
  shell: '#030810',
  card: 'rgba(255, 255, 255, 0.05)',
  cardStrong: 'rgba(255, 255, 255, 0.07)',
  cardMuted: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(89, 178, 225, 0.35)',
  text: '#EEF2FF',
  textSoft: '#C8D8F0',
  textMuted: '#7C9CC0',
  textSubtle: '#4B6080',
  textFaint: '#2A3A54',
  tabInactive: '#3A5070',
  ink: '#070D1C',
};

const MIST: ColorPaletteSlice = {
  background: '#F0F4F8',
  backgroundSoft: '#E4EBF2',
  shell: '#D8E2EC',
  card: 'rgba(255, 255, 255, 0.78)',
  cardStrong: 'rgba(255, 255, 255, 0.92)',
  cardMuted: 'rgba(0, 0, 0, 0.03)',
  border: 'rgba(20, 40, 60, 0.1)',
  borderStrong: 'rgba(59, 130, 246, 0.35)',
  text: '#0F1C2A',
  textSoft: '#2A3A4C',
  textMuted: '#5A6E82',
  textSubtle: '#7A8FA3',
  textFaint: '#A0B0C0',
  tabInactive: '#8A9CB0',
  ink: '#0F1C2A',
};

function tintNight(base: ColorPaletteSlice, tint: string, borderAccent: string): ColorPaletteSlice {
  return {
    ...base,
    background: tint,
    backgroundSoft: base.backgroundSoft,
    border: borderAccent,
    borderStrong: `${borderAccent.replace('0.18', '0.35').replace('0.12', '0.35').replace('0.2', '0.4')}`,
  };
}

function tintDay(base: ColorPaletteSlice, wash: string): ColorPaletteSlice {
  return {
    ...base,
    background: wash,
    backgroundSoft: base.backgroundSoft,
  };
}

const TYPE_BY_ID = Object.fromEntries(ACCENT_THEMES.map((t) => [t.id, t.typeStyle])) as Record<
  ColorPaletteId,
  AccentTypeStyle
>;

/** Curated palettes — each color has day + night surface/font pairs. */
export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'sky',
    label: 'Sky',
    swatch: { primary: '#378ADD', secondary: '#FAC775' },
    typeStyle: TYPE_BY_ID.sky,
    nightTint: '#07121F',
    night: tintNight(MIDNIGHT, '#07121F', 'rgba(55, 138, 221, 0.2)'),
    day: {
      ...tintDay(MIST, '#EAF3FB'),
      borderStrong: 'rgba(55, 138, 221, 0.35)',
    },
  },
  {
    id: 'citrus',
    label: 'Citrus',
    swatch: { primary: '#EF9F27', secondary: '#712B13' },
    typeStyle: TYPE_BY_ID.citrus,
    nightTint: '#1A1208',
    night: tintNight(MIDNIGHT, '#1A1208', 'rgba(239, 159, 39, 0.22)'),
    day: {
      ...tintDay(MIST, '#FBF4E8'),
      text: '#712B13',
      textSoft: '#8A4A28',
      textMuted: '#9A6A48',
      borderStrong: 'rgba(239, 159, 39, 0.4)',
    },
  },
  {
    id: 'coral',
    label: 'Coral',
    swatch: { primary: '#D85A30', secondary: '#FAC775' },
    typeStyle: TYPE_BY_ID.coral,
    nightTint: '#1A0C08',
    night: tintNight(MIDNIGHT, '#1A0C08', 'rgba(216, 90, 48, 0.22)'),
    day: {
      ...tintDay(MIST, '#FAF0EB'),
      borderStrong: 'rgba(216, 90, 48, 0.35)',
    },
  },
  {
    id: 'berry',
    label: 'Berry',
    swatch: { primary: '#7F77DD', secondary: '#F4C0D1' },
    typeStyle: TYPE_BY_ID.berry,
    nightTint: '#100A1C',
    night: {
      background: '#100A1C',
      backgroundSoft: '#1A1628',
      shell: '#0C0A12',
      card: 'rgba(255, 255, 255, 0.06)',
      cardStrong: 'rgba(255, 255, 255, 0.09)',
      cardMuted: 'rgba(255, 255, 255, 0.03)',
      border: 'rgba(127, 119, 221, 0.2)',
      borderStrong: 'rgba(127, 119, 221, 0.4)',
      text: '#F5F0FF',
      textSoft: '#D4CBE8',
      textMuted: '#9B8FBF',
      textSubtle: '#6B6288',
      textFaint: '#3D3654',
      tabInactive: '#5A5270',
      ink: '#100A1C',
    },
    day: {
      ...MIST,
      background: '#F4F0FA',
      backgroundSoft: '#EBE4F5',
      shell: '#E0D6EF',
      border: 'rgba(90, 60, 140, 0.12)',
      borderStrong: 'rgba(127, 119, 221, 0.35)',
      text: '#1A1230',
      textSoft: '#3A2E55',
      textMuted: '#6B5F88',
    },
  },
];

export const DEFAULT_COLOR_PALETTE_ID: ColorPaletteId = DEFAULT_ACCENT_THEME_ID;

const PALETTE_IDS = new Set<string>(COLOR_PALETTES.map((p) => p.id));

export function isColorPaletteId(value: string | null | undefined): value is ColorPaletteId {
  return Boolean(value && PALETTE_IDS.has(value));
}

export function migrateColorPaletteId(value: string | null | undefined): ColorPaletteId {
  return migrateAccentThemeId(value);
}

export function getColorPalette(id?: string | null): ColorPalette {
  const resolved = migrateColorPaletteId(id);
  return COLOR_PALETTES.find((p) => p.id === resolved) ?? COLOR_PALETTES[2]!;
}

/** AccentTheme view of a palette (compat with existing consumers). */
export function paletteAsAccentTheme(palette: ColorPalette): AccentTheme {
  return {
    id: palette.id,
    label: palette.label,
    primary: palette.swatch.primary,
    secondary: palette.swatch.secondary,
    typeStyle: palette.typeStyle,
  };
}

export function resolveThemeFromPalette(
  paletteId: ColorPaletteId | string | null | undefined,
  isDark: boolean
): OrbitColorPalette & { isDark: boolean; accentTheme: AccentTheme } {
  const palette = getColorPalette(paletteId);
  const slice = isDark ? palette.night : palette.day;
  const accent = paletteAsAccentTheme(palette);

  return {
    ...slice,
    orbitBlue: accent.primary,
    orbitBlueDeep: accent.secondary,
    orbitBlueDark: accent.secondary,
    primary: accent.primary,
    accent: choremaxxBrand.mint,
    rewardsGold: choremaxxBrand.gold,
    novaCyan: '#06B6D4',
    success: '#34D399',
    warning: '#FB923C',
    danger: '#F87171',
    planPurple: '#A78BFA',
    rankGold: '#FBBF24',
    brandSlate: choremaxxBrand.slate,
    brandFaded: choremaxxBrand.faded,
    isDark,
    accentTheme: accent,
  };
}

/** @deprecated Prefer getColorPalette — thin re-export for migration. */
export function getAccentThemeCompat(id?: string | null): AccentTheme {
  return getAccentTheme(id);
}

export { LEGACY_ACCENT_TO_PALETTE };
