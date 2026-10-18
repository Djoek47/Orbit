import { useMemo } from 'react';
import { StyleSheet, TextStyle } from 'react-native';

import { typography as typeScale } from '@/constants/orbit-theme';
import type { OrbitColorPalette } from '@/constants/orbit-theme';
import { useOrbitOptional } from '@/store/orbit-store';

/** White wash at night, dark wash by day — Make Design 8 glass. */
export function glassFill(isDark: boolean, alpha = 0.05): string {
  return isDark ? `rgba(255,255,255,${alpha})` : `rgba(15,28,42,${Math.min(alpha * 1.15, 0.12)})`;
}

export function glassBorder(isDark: boolean, alpha = 0.1): string {
  return isDark ? `rgba(255,255,255,${alpha})` : `rgba(15,28,42,${Math.min(alpha * 1.2, 0.14)})`;
}

export function glassCardStrong(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
}

type ColoredType = {
  largeTitle: TextStyle;
  title1: TextStyle;
  title2: TextStyle;
  title3: TextStyle;
  headline: TextStyle;
  body: TextStyle;
  callout: TextStyle;
  subheadline: TextStyle;
  footnote: TextStyle;
  caption1: TextStyle;
  caption2: TextStyle;
  eyebrow: TextStyle;
  metricLarge: TextStyle;
  metricSmall: TextStyle;
  buttonLabel: TextStyle;
};

/** Merge size-only type scale with live palette text colors. */
export function coloredTypography(palette: OrbitColorPalette): ColoredType {
  return {
    largeTitle: { ...typeScale.largeTitle, color: palette.text },
    title1: { ...typeScale.title1, color: palette.text },
    title2: { ...typeScale.title2, color: palette.text },
    title3: { ...typeScale.title3, color: palette.text },
    headline: { ...typeScale.headline, color: palette.text },
    body: { ...typeScale.body, color: palette.textSoft },
    callout: { ...typeScale.callout, color: palette.textSoft },
    subheadline: { ...typeScale.subheadline, color: palette.textMuted },
    footnote: { ...typeScale.footnote, color: palette.textMuted },
    caption1: { ...typeScale.caption1, color: palette.textSubtle },
    caption2: { ...typeScale.caption2, color: palette.textSubtle },
    eyebrow: { ...typeScale.eyebrow, color: palette.textSubtle },
    metricLarge: { ...typeScale.metricLarge, color: palette.text },
    metricSmall: { ...typeScale.metricSmall, color: palette.text },
    buttonLabel: { ...typeScale.buttonLabel, color: palette.ink },
  };
}

export function screenContainer(palette: OrbitColorPalette) {
  return {
    flex: 1 as const,
    backgroundColor: palette.background,
  };
}

/**
 * Live Day/Night colors + glass helpers for screens/components.
 * Prefer this over static `orbitColors` / baked typography colors.
 */
const FALLBACK_PALETTE: OrbitColorPalette & { isDark: boolean } = {
  background: '#070D1C',
  backgroundSoft: '#0A1525',
  shell: '#030810',
  card: 'rgba(255,255,255,0.05)',
  cardStrong: 'rgba(255,255,255,0.07)',
  cardMuted: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(89,178,225,0.35)',
  text: '#EEF2FF',
  textSoft: '#C8D8F0',
  textMuted: '#7C9CC0',
  textSubtle: '#4B6080',
  textFaint: '#2A3A54',
  tabInactive: '#3A5070',
  orbitBlue: '#D85A30',
  orbitBlueDeep: '#FAC775',
  orbitBlueDark: '#712B13',
  primary: '#D85A30',
  accent: '#76C4AE',
  rewardsGold: '#FAC775',
  poppinsCyan: '#06B6D4',
  success: '#34D399',
  warning: '#FB923C',
  danger: '#F87171',
  planPurple: '#A78BFA',
  rankGold: '#FBBF24',
  ink: '#070D1C',
  brandSlate: '#5B7A9A',
  brandFaded: '#3A5070',
  isDark: true,
};

export function useOrbitColors() {
  const orbit = useOrbitOptional();
  const c = useMemo(
    () => orbit?.orbitPalette ?? FALLBACK_PALETTE,
    [orbit?.orbitPalette]
  );

  const isDark = c.isDark ?? true;
  const type = useMemo(() => coloredTypography(c), [c]);
  const screen = useMemo(() => screenContainer(c), [c]);

  return {
    c,
    isDark,
    type,
    glass: (alpha = 0.05) => glassFill(isDark, alpha),
    glassBorder: (alpha = 0.1) => glassBorder(isDark, alpha),
    screen,
  };
}

/** StyleSheet-friendly glass tokens for a known isDark (non-hook). */
export function makeGlassTokens(isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: glassFill(isDark, 0.05),
      borderColor: glassBorder(isDark, 0.1),
    },
    cardStrong: {
      backgroundColor: glassCardStrong(isDark),
      borderColor: glassBorder(isDark, 0.12),
    },
  });
}
