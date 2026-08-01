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

/**
 * @deprecated Use `space` (design-system/02-design-language.md §3) — this legacy
 * scale drifts from the documented 4/8/12/16/20/24/32/40/48/64/96 rungs and is
 * kept only so screens not yet migrated in the iOS 27 rebuild keep compiling.
 */
export const orbitSpacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * The Apple spacing scale — see `docs/design-system/02-design-language.md` §3.1.
 * Every new margin/gap/padding value must be one of these eleven numbers.
 */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  section: 48,
  screen: 64,
  hero: 96,
} as const;

/**
 * @deprecated Use `radius` (design-system/02-design-language.md §4) — this legacy
 * scale (12/16/24/999) drifts from screens that still use ad hoc 10/14/18/20/22/26/28
 * values; kept only for screens not yet migrated in the iOS 27 rebuild.
 */
export const orbitRadius = {
  sm: 12,
  md: 16,
  lg: 24,
  hero: 24,
  full: 999,
};

/**
 * The one consistent corner-radius system — see `docs/design-system/02-design-language.md` §4.
 * Use with `borderCurve: 'continuous'` at every radius ≥ `control`.
 */
export const radius = {
  control: 12,
  card: 20,
  cardLarge: 28,
  full: 999,
} as const;

/**
 * Semantic shadow tiers — see `docs/design-system/02-design-language.md` §5.
 * Shadows are only allowed on floating chrome, drag/lift state, and the single
 * emphasized card per screen. Never on standard rows/cards/buttons at rest.
 */
export const shadow = {
  floating: {
    dark: {
      shadowColor: '#000000',
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    light: {
      shadowColor: '#0F1C2A',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
  },
  lifted: {
    dark: {
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    light: {
      shadowColor: '#0F1C2A',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
  },
} as const;

/** Make primary CTAs: py-3.5–4, fontWeight 700, dark label on blue gradient */
export const orbitControl = {
  buttonHeight: 52,
  buttonLabelSize: 14,
  buttonLabelWeight: '700' as const,
  inputHeight: 52,
  chipHeight: 32,
};

/**
 * @deprecated Use `typography` (design-system/02-design-language.md §2) — see
 * §2.4's migration map for the 1:1 replacement of each key below. Kept only so
 * screens not yet migrated in the iOS 27 rebuild keep compiling.
 */
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
  /** Under-chrome page label — matches Home date line. */
  pageEyebrow: {
    color: '#6B82A3',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.35,
    lineHeight: 14,
    textTransform: 'uppercase',
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

/**
 * The Apple-style type scale — see `docs/design-system/02-design-language.md` §2.2.
 * SF Pro resolves automatically on iOS via the unset system `fontFamily`; do not
 * set a custom font family on these styles.
 */
export const typography = StyleSheet.create({
  largeTitle: { color: orbitColors.text, fontSize: 34, fontWeight: '700', lineHeight: 41 },
  title1: { color: orbitColors.text, fontSize: 28, fontWeight: '700', lineHeight: 34 },
  title2: { color: orbitColors.text, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  title3: { color: orbitColors.text, fontSize: 20, fontWeight: '600', lineHeight: 25 },
  headline: { color: orbitColors.text, fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { color: orbitColors.textSoft, fontSize: 17, fontWeight: '400', lineHeight: 22 },
  callout: { color: orbitColors.textSoft, fontSize: 16, fontWeight: '400', lineHeight: 21 },
  subheadline: { color: orbitColors.textMuted, fontSize: 15, fontWeight: '400', lineHeight: 20 },
  footnote: { color: orbitColors.textMuted, fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption1: { color: orbitColors.textSubtle, fontSize: 12, fontWeight: '400', lineHeight: 16 },
  caption2: { color: orbitColors.textSubtle, fontSize: 11, fontWeight: '500', lineHeight: 13 },
  eyebrow: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  metricLarge: { color: orbitColors.text, fontSize: 34, fontWeight: '800' },
  metricSmall: { color: orbitColors.text, fontSize: 22, fontWeight: '700' },
  buttonLabel: { color: orbitColors.ink, fontSize: 17, fontWeight: '600' },
});

/** Legacy right-gutter when chips floated alone — chrome now owns logo+chips. */
export const HEADER_CHIPS_GUTTER = 8;

/** Sticky GlobalHeaderChips body under status bar; screens pad content with useTabChromePaddingTop. */
export const TAB_CHROME_BODY = 52;

/** Must match `TAB_CHROME_CONTENT_GAP` in global-header-chips — do not invent per-screen gaps. */
export const TAB_CHROME_CONTENT_GAP = 14;

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
    paddingTop: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
