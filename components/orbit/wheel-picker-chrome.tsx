/**
 * Wheel picker affordance — Revision D §5.2.b.
 * Top/bottom fade + fixed centre selection band (no scroll bar).
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = ViewProps & {
  bandHeight?: number;
};

export function WheelPickerChrome({ children, style, bandHeight = 40, ...rest }: Props) {
  const { c, isDark } = useOrbitColors();
  const edge = isDark ? 'rgba(7,13,28,0.92)' : 'rgba(248,250,252,0.92)';
  const clear = isDark ? 'rgba(7,13,28,0)' : 'rgba(248,250,252,0)';

  return (
    <View style={[styles.wrap, style]} {...rest}>
      {children}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            height: bandHeight,
            marginTop: -bandHeight / 2,
            borderColor: `${c.accent}44`,
            backgroundColor: `${c.accent}14`,
          },
        ]}
      />
      <LinearGradient colors={[edge, clear]} style={styles.fadeTop} pointerEvents="none" />
      <LinearGradient colors={[clear, edge]} style={styles.fadeBottom} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    position: 'relative',
  },
  band: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  fadeTop: {
    height: 28,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
    height: 28,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
