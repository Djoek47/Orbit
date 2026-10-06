/**
 * Readable frosted glass for overlays — BlurView + near-opaque fill so
 * background type never bleeds through sheet copy.
 */
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type PanelProps = {
  children: React.ReactNode;
  borderColor: string;
  style?: StyleProp<ViewStyle>;
};

export function FrostedPanel({ children, borderColor, style }: PanelProps) {
  const { isDark } = useOrbitColors();
  // Near-opaque fill is the readability guarantee; blur is atmosphere only.
  // glassFill(~0.05) let dashboard type bleed through — never use that here.
  const frostFill = isDark ? 'rgba(14, 10, 8, 0.97)' : 'rgba(252, 253, 255, 0.97)';
  const intensity =
    Platform.OS === 'ios'
      ? Math.max(material.liquidGlass.intensity, 80)
      : Math.max(material.liquidGlass.androidIntensity, 100);

  return (
    <View style={[styles.shell, { borderColor }, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BlurView
          intensity={intensity}
          tint={resolveBlurTint(isDark)}
          experimentalBlurMethod={androidBlurMethod}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: frostFill }]} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function frostedBackdropColor(isDark: boolean): string {
  return isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 28, 42, 0.48)';
}

const styles = StyleSheet.create({
  shell: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
