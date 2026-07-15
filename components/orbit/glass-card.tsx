import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';

type GlassCardProps = PropsWithChildren<{
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function GlassCard({ children, elevated = false, style }: GlassCardProps) {
  return <View style={[styles.card, elevated && styles.elevated, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: orbitColors.card,
    borderColor: orbitColors.border,
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    boxShadow: '0 18px 30px rgba(0, 0, 0, 0.22)',
    gap: orbitSpacing.md,
    padding: orbitSpacing.lg,
  },
  elevated: {
    backgroundColor: orbitColors.cardStrong,
    borderColor: orbitColors.borderStrong,
  },
});
