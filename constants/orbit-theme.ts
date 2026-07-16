import { StyleSheet } from 'react-native';

/** Make v5 tokens from Design Orbit AI App (theme.css + App.tsx). */
export const orbitColors = {
  background: '#070D1C',
  backgroundSoft: '#0A1525',
  card: 'rgba(255, 255, 255, 0.05)',
  cardStrong: 'rgba(15, 26, 48, 0.95)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(56, 189, 248, 0.3)',
  text: '#EEF2FF',
  textMuted: '#7C9CC0',
  textSubtle: '#4B6080',
  orbitBlue: '#38BDF8',
  novaCyan: '#06B6D4',
  success: '#34D399',
  warning: '#FB923C',
  danger: '#F87171',
  planPurple: '#A78BFA',
  rankGold: '#FBBF24',
};

export const orbitSpacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/** Make radius ~1.25rem (20) with larger cards at 24. */
export const orbitRadius = {
  sm: 12,
  md: 16,
  lg: 20,
  hero: 24,
};

/** Make primary CTAs — full-width pill buttons, bold labels. */
export const orbitControl = {
  buttonHeight: 52,
  buttonLabelSize: 15,
  buttonLabelWeight: '700' as const,
  inputHeight: 52,
  chipHeight: 36,
};

export const orbitTypography = StyleSheet.create({
  display: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  title: {
    color: orbitColors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardTitle: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    color: orbitColors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  caption: {
    color: orbitColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  metric: {
    color: orbitColors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  buttonLabel: {
    color: orbitColors.text,
    fontSize: orbitControl.buttonLabelSize,
    fontWeight: orbitControl.buttonLabelWeight,
  },
});

export const orbitScreen = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: orbitColors.background,
  },
  content: {
    gap: orbitSpacing.md,
    padding: orbitSpacing.md,
    paddingBottom: orbitSpacing.xxl,
  },
  header: {
    gap: 4,
    paddingTop: orbitSpacing.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: orbitSpacing.md,
  },
});
