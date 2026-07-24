import { StyleSheet } from 'react-native';

import { choremaxxBrand } from '@/constants/choremaxx-brand';

/**
 * Choremaxx Make UI tokens. Primary cyan/mint follow the official logo lockup.
 * Static `orbitColors` remains the dark Midnight default for StyleSheets that
 * have not migrated to `useOrbitTheme().colors`.
 */
export type OrbitColorPalette = {
  background: string;
  backgroundSoft: string;
  shell: string;
  card: string;
  cardStrong: string;
  cardMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textSubtle: string;
  textFaint: string;
  tabInactive: string;
  orbitBlue: string;
  orbitBlueDeep: string;
  orbitBlueDark: string;
  primary: string;
  accent: string;
  rewardsGold: string;
  novaCyan: string;
  success: string;
  warning: string;
  danger: string;
  planPurple: string;
  rankGold: string;
  ink: string;
  brandSlate: string;
  brandFaded: string;
};

export const orbitColorsDark: OrbitColorPalette = {
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
  ink: '#070D1C',
  brandSlate: choremaxxBrand.slate,
  brandFaded: choremaxxBrand.faded,
};

export const orbitColorsLight: OrbitColorPalette = {
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
  orbitBlue: choremaxxBrand.cyan,
  orbitBlueDeep: '#3A9BC8',
  orbitBlueDark: '#2B6F94',
  primary: choremaxxBrand.cyan,
  accent: choremaxxBrand.mint,
  rewardsGold: choremaxxBrand.gold,
  novaCyan: '#06B6D4',
  success: '#059669',
  warning: '#EA580C',
  danger: '#DC2626',
  planPurple: '#7C3AED',
  rankGold: '#D97706',
  ink: '#0F1C2A',
  brandSlate: choremaxxBrand.slate,
  brandFaded: choremaxxBrand.faded,
};

/** Default static export — Midnight dark (back-compat for StyleSheets). */
export const orbitColors = orbitColorsDark;

export const orbitTabColors = {
  home: choremaxxBrand.cyan,
  tasks: choremaxxBrand.mint,
  plan: '#A78BFA',
  ranking: choremaxxBrand.gold,
  nova: '#06B6D4',
} as const;

export const orbitSpacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/** Make: rounded-2xl≈16, rounded-3xl≈24 */
export const orbitRadius = {
  sm: 12,
  md: 16,
  lg: 24,
  hero: 24,
  full: 999,
};

/** Make primary CTAs: py-3.5–4, fontWeight 700, dark label on blue gradient */
export const orbitControl = {
  buttonHeight: 52,
  buttonLabelSize: 14,
  buttonLabelWeight: '700' as const,
  inputHeight: 52,
  chipHeight: 32,
};

export const orbitTypography = StyleSheet.create({
  display: {
    color: orbitColors.text,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 29,
  },
  title: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  cardTitle: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    color: orbitColors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  caption: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  eyebrow: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '400',
  },
  metric: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  buttonLabel: {
    color: orbitColors.ink,
    fontSize: orbitControl.buttonLabelSize,
    fontWeight: orbitControl.buttonLabelWeight,
  },
});

/** Legacy right-gutter when chips floated alone — chrome now owns logo+chips. */
export const HEADER_CHIPS_GUTTER = 8;

/** Sticky GlobalHeaderChips body under status bar; screens pad content with useTabChromePaddingTop. */
export const TAB_CHROME_BODY = 52;

export const orbitScreen = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: orbitColors.background,
  },
  content: {
    alignSelf: 'stretch',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    width: '100%',
  },
  header: {
    gap: 2,
    paddingTop: 4,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
