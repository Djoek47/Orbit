/**
 * Unified personalization: one palette id owns day + night surface/font/accent
 * pairs. Replaces separate accent packs + background packs as the user-facing
 * personalization model (Design 8).
 */

import type { AccentTheme, AccentThemeId, AccentTypeStyle } from '@/constants/accent-themes';
import { ACCENT_THEMES, DEFAULT_ACCENT_THEME_ID, getAccentTheme } from '@/constants/accent-themes';
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
    borderStrong: `${borderAccent.replace('0.18', '0.35').replace('0.12', '0.35')}`,
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
    id: 'ocean',
    label: 'Ocean',
    swatch: { primary: '#59B2E1', secondary: '#3A9BC8' },
    typeStyle: TYPE_BY_ID.ocean,
    nightTint: '#070D1C',
    night: { ...MIDNIGHT, borderStrong: 'rgba(89, 178, 225, 0.4)' },
    day: tintDay(MIST, '#EDF5FA'),
  },
  {
    id: 'aurora',
    label: 'Aurora',
    swatch: { primary: '#76C4AE', secondary: '#4FA88F' },
    typeStyle: TYPE_BY_ID.aurora,
    nightTint: '#071A0F',
    night: tintNight(MIDNIGHT, '#071A0F', 'rgba(52, 211, 153, 0.18)'),
    day: tintDay(MIST, '#EAF7F2'),
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    swatch: { primary: '#A78BFA', secondary: '#7C3AED' },
    typeStyle: TYPE_BY_ID.cosmic,
    nightTint: '#0D0A1C',
    night: {
      background: '#0D0A1C',
      backgroundSoft: '#1A1628',
      shell: '#0C0A12',
      card: 'rgba(255, 255, 255, 0.06)',
      cardStrong: 'rgba(255, 255, 255, 0.09)',
      cardMuted: 'rgba(255, 255, 255, 0.03)',
      border: 'rgba(167, 139, 250, 0.18)',
      borderStrong: 'rgba(167, 139, 250, 0.4)',
      text: '#F5F0FF',
      textSoft: '#D4CBE8',
      textMuted: '#9B8FBF',
      textSubtle: '#6B6288',
      textFaint: '#3D3654',
      tabInactive: '#5A5270',
      ink: '#0D0A1C',
    },
    day: {
      ...MIST,
      background: '#F4F0FA',
      backgroundSoft: '#EBE4F5',
      shell: '#E0D6EF',
      border: 'rgba(90, 60, 140, 0.12)',
      borderStrong: 'rgba(124, 58, 237, 0.35)',
      text: '#1A1230',
      textSoft: '#3A2E55',
      textMuted: '#6B5F88',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    swatch: { primary: '#FB923C', secondary: '#EA580C' },
    typeStyle: TYPE_BY_ID.sunset,
    nightTint: '#1A0C07',
    night: tintNight(MIDNIGHT, '#1A0C07', 'rgba(251, 146, 60, 0.2)'),
    day: tintDay(MIST, '#FAF3EC'),
  },
  {
    id: 'rose',
    label: 'Rose',
    swatch: { primary: '#F472B6', secondary: '#EC4899' },
    typeStyle: TYPE_BY_ID.rose,
    nightTint: '#1A071A',
    night: tintNight(MIDNIGHT, '#1A071A', 'rgba(244, 114, 182, 0.2)'),
    day: tintDay(MIST, '#FAEFF5'),
  },
  {
    id: 'forest',
    label: 'Forest',
    swatch: { primary: '#34D399', secondary: '#059669' },
    typeStyle: TYPE_BY_ID.forest,
    nightTint: '#061410',
    night: tintNight(MIDNIGHT, '#061410', 'rgba(52, 211, 153, 0.18)'),
    day: tintDay(MIST, '#EAF6F0'),
  },
  {
    id: 'slate',
    label: 'Slate',
    swatch: { primary: '#94A3B8', secondary: '#64748B' },
    typeStyle: TYPE_BY_ID.slate,
    nightTint: '#0B1018',
    night: tintNight(MIDNIGHT, '#0B1018', 'rgba(148, 163, 184, 0.2)'),
    day: tintDay(MIST, '#F2F4F6'),
  },
  {
    id: 'amber',
    label: 'Amber',
    swatch: { primary: '#FBBF24', secondary: '#D97706' },
    typeStyle: TYPE_BY_ID.amber,
    nightTint: '#161008',
    night: tintNight(MIDNIGHT, '#161008', 'rgba(251, 191, 36, 0.2)'),
    day: tintDay(MIST, '#FAF6EB'),
  },
  {
    id: 'violet',
    label: 'Violet',
    swatch: { primary: '#8B5CF6', secondary: '#6D28D9' },
    typeStyle: TYPE_BY_ID.violet,
    nightTint: '#100A1C',
    night: tintNight(MIDNIGHT, '#100A1C', 'rgba(139, 92, 246, 0.22)'),
    day: tintDay(MIST, '#F3EFFA'),
  },
];

export const DEFAULT_COLOR_PALETTE_ID: ColorPaletteId = DEFAULT_ACCENT_THEME_ID;

const PALETTE_IDS = new Set<string>(COLOR_PALETTES.map((p) => p.id));

export function isColorPaletteId(value: string | null | undefined): value is ColorPaletteId {
  return Boolean(value && PALETTE_IDS.has(value));
}

export function getColorPalette(id?: string | null): ColorPalette {
  return COLOR_PALETTES.find((p) => p.id === id) ?? COLOR_PALETTES[0]!;
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
