import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { orbitColors } from '@/constants/orbit-theme';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
type LogoVariant = 'full' | 'icon' | 'wordmark';

const SIZES: Record<LogoSize, { iconH: number; textSize: number; gap: number }> = {
  sm: { iconH: 20, textSize: 16, gap: 6 },
  md: { iconH: 28, textSize: 22, gap: 8 },
  lg: { iconH: 40, textSize: 32, gap: 10 },
  xl: { iconH: 56, textSize: 44, gap: 14 },
};

type ChoremaxxLogoProps = {
  size?: LogoSize;
  variant?: LogoVariant;
  style?: ViewStyle;
};

/** Teal layered house + gold sparkle + Choremaxx wordmark (Make v7). */
export function ChoremaxxLogo({ size = 'md', variant = 'full', style }: ChoremaxxLogoProps) {
  const { iconH, textSize, gap } = SIZES[size];
  const iconW = iconH * 1.05;

  return (
    <View style={[styles.row, { gap }, style]}>
      {variant === 'full' || variant === 'icon' ? <ChoremaxxIcon width={iconW} height={iconH} /> : null}
      {variant === 'full' || variant === 'wordmark' ? (
        <Text style={[styles.wordmark, { fontSize: textSize, lineHeight: textSize * 1.15 }]}>choremaxx</Text>
      ) : null}
    </View>
  );
}

export function ChoremaxxIcon({ width = 32, height = 30 }: { width?: number; height?: number }) {
  const uid = `cmx-${Math.round(width)}-${Math.round(height)}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 48 46" fill="none">
      <Defs>
        <LinearGradient id={`${uid}-house`} x1="0" y1="0" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#2DD4BF" />
          <Stop offset="100%" stopColor="#38BDF8" />
        </LinearGradient>
        <LinearGradient id={`${uid}-inner`} x1="0" y1="0" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#34D399" />
          <Stop offset="100%" stopColor="#22D3EE" />
        </LinearGradient>
      </Defs>
      <Path
        d="M24 3L44 19V43H30V29H18V43H4V19L24 3Z"
        stroke={`url(#${uid}-house)`}
        strokeWidth={3.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M24 10L38 22V40H30V29H18V40H10V22L24 10Z"
        stroke={`url(#${uid}-inner)`}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      <Path d="M8 2 L8.8 5.5 L8 9 L7.2 5.5 Z" fill="#F59E0B" />
      <Path d="M4 5.5 L7.5 6.3 L11 5.5 L7.5 4.7 Z" fill="#F59E0B" />
      <Circle cx="8" cy="5.5" r="0.9" fill="#FBBF24" />
    </Svg>
  );
}

/** Compact brand badge for headers / nav. */
export function ChoremaxxBadge() {
  return (
    <View style={styles.badge}>
      <ChoremaxxIcon width={18} height={17} />
      <Text style={styles.badgeText}>choremaxx</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  badgeText: {
    color: orbitColors.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  wordmark: {
    color: orbitColors.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
