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

const FROST_ALPHA_HEX = 'F7';
const DARK_FROST_FALLBACK = 'rgba(10, 21, 37, 0.97)';
const LIGHT_FROST = 'rgba(252, 253, 255, 0.97)';

function opaqueTint(hex: string): string | null {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${FROST_ALPHA_HEX}` : null;
}

export function FrostedPanel({ children, borderColor, style }: PanelProps) {
  const { c, isDark } = useOrbitColors();
  // Near-opaque fill is the readability guarantee; blur is atmosphere only.
  // glassFill(~0.05) let dashboard type bleed through — never use that here.
  // Dark frost follows the theme's elevated surface so sheets match Night / tinted themes.
  const frostFill = isDark ? (opaqueTint(c.backgroundSoft) ?? DARK_FROST_FALLBACK) : LIGHT_FROST;
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
        {isDark ? <View style={styles.edgeHighlight} /> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function frostedBackdropColor(isDark: boolean): string {
  return isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 28, 42, 0.48)';
}

/** Inset row-group surface that stays visible on top of the frost in both modes. */
export function frostedGroupFill(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 28, 42, 0.045)';
}

export function frostedHairline(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 28, 42, 0.1)';
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
  edgeHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
