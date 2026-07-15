import { StyleSheet } from 'react-native';

export const orbitColors = {
  background: '#070B14',
  backgroundSoft: '#0B1220',
  card: 'rgba(19, 28, 46, 0.72)',
  cardStrong: 'rgba(29, 41, 57, 0.84)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(0, 194, 255, 0.32)',
  text: '#FFFFFF',
  textMuted: '#98A2B3',
  textSubtle: '#667085',
  orbitBlue: '#2979FF',
  novaCyan: '#00C2FF',
  success: '#32D583',
  warning: '#FFB547',
  danger: '#FF5A5F',
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
