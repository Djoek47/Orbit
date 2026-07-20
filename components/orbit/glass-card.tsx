import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { orbitColors, orbitRadius } from '@/constants/orbit-theme';

type GlassCardProps = PropsWithChildren<{
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Make card chrome: rgba(255,255,255,0.05) + 1px border + rounded-3xl + p-4 */
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
    gap: 12,
    padding: 16,
  },
  elevated: {
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderColor: 'rgba(56,189,248,0.18)',
  },
});
