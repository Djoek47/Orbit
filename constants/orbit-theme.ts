import { StyleSheet } from 'react-native';

/** Choremaxx Make v7 tokens — keep export names for existing imports. */
export const orbitColors = {
  background: '#070D1C',
  backgroundSoft: '#0F1A30',
  card: 'rgba(255, 255, 255, 0.06)',
  cardStrong: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(59, 181, 240, 0.32)',
  text: '#EEF2FF',
  textMuted: '#7C9CC0',
  textSubtle: '#4B6080',
  /** Primary brand blue (Make v7). */
  orbitBlue: '#3BB5F0',
  primary: '#3BB5F0',
  accent: '#2DD4BF',
  novaCyan: '#3BB5F0',
  rewardsGold: '#F59E0B',
  planPurple: '#A78BFA',
  success: '#34D399',
  warning: '#F59E0B',
  danger: '#F87171',
};

export const orbitSpacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const orbitRadius = {
  sm: 12,
  md: 18,
  lg: 24,
  hero: 32,
};

export const orbitTypography = StyleSheet.create({
  display: {
    color: orbitColors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    color: orbitColors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0,
  },
  cardTitle: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0,
  },
  body: {
    color: orbitColors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    color: orbitColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  metric: {
    color: orbitColors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0,
  },
});

export const orbitScreen = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: orbitColors.background,
  },
  content: {
    gap: orbitSpacing.lg,
    padding: orbitSpacing.lg,
    paddingBottom: 120,
  },
  header: {
    gap: orbitSpacing.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
