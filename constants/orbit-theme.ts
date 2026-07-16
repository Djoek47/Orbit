import { StyleSheet } from 'react-native';

/**
 * Exact Make v5 tokens from Design Orbit AI App
 * (theme.css + App.tsx / screen inline styles). Do not invent alternatives.
 */
export const orbitColors = {
  background: '#070D1C',
  backgroundSoft: '#0A1525',
  shell: '#030810',
  card: 'rgba(255, 255, 255, 0.05)',
  cardStrong: 'rgba(255, 255, 255, 0.07)',
  cardMuted: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(56, 189, 248, 0.3)',
  text: '#EEF2FF',
  textSoft: '#C8D8F0',
  textMuted: '#7C9CC0',
  textSubtle: '#4B6080',
  textFaint: '#2A3A54',
  tabInactive: '#3A5070',
  orbitBlue: '#38BDF8',
  orbitBlueDeep: '#0EA5E9',
  orbitBlueDark: '#0369A1',
  novaCyan: '#06B6D4',
  success: '#34D399',
  warning: '#FB923C',
  danger: '#F87171',
  planPurple: '#A78BFA',
  rankGold: '#FBBF24',
  ink: '#070D1C',
};

export const orbitTabColors = {
  home: '#38BDF8',
  tasks: '#34D399',
  plan: '#A78BFA',
  ranking: '#FBBF24',
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

export const orbitScreen = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: orbitColors.background,
  },
  content: {
    gap: 16,
    // Clear global Notifications + Settings chips (Make App overlay)
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 24,
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
