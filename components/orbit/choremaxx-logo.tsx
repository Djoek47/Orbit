import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { choremaxxBrand } from '@/constants/choremaxx-brand';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
type LogoVariant = 'full' | 'icon' | 'wordmark';

const SIZES: Record<LogoSize, { iconH: number; textSize: number; gap: number }> = {
  sm: { iconH: 22, textSize: 17, gap: 7 },
  md: { iconH: 30, textSize: 24, gap: 9 },
  lg: { iconH: 42, textSize: 34, gap: 11 },
  xl: { iconH: 58, textSize: 46, gap: 14 },
};

type ChoremaxxLogoProps = {
  size?: LogoSize;
  variant?: LogoVariant;
  style?: ViewStyle;
};

/**
 * Official Choremaxx lockup: cyan roof + mint ribbon + gold sparkle,
 * wordmark “chorema” in cyan with dual-tone “xx”.
 */
export function ChoremaxxLogo({ size = 'md', variant = 'full', style }: ChoremaxxLogoProps) {
  const { iconH, textSize, gap } = SIZES[size];
  const iconW = iconH * 1.15;

  return (
    <View style={[styles.row, { gap }, style]} accessibilityRole="image" accessibilityLabel="Choremaxx">
      {variant === 'full' || variant === 'icon' ? <ChoremaxxIcon width={iconW} height={iconH} /> : null}
      {variant === 'full' || variant === 'wordmark' ? (
        <Wordmark fontSize={textSize} />
      ) : null}
    </View>
  );
}

function Wordmark({ fontSize }: { fontSize: number }) {
  const xSize = fontSize * 0.96;
  return (
    <View style={styles.wordRow}>
      <Text style={[styles.chorema, { fontSize, lineHeight: fontSize * 1.1 }]}>chorema</Text>
      <Text style={[styles.xPrimary, { fontSize: xSize, lineHeight: fontSize * 1.1 }]}>x</Text>
      <Text style={[styles.xFaded, { fontSize: xSize, lineHeight: fontSize * 1.1 }]}>x</Text>
    </View>
  );
}

/** Stylized house mark: cyan chevron roof, mint ribbon base, gold sparkle. */
export function ChoremaxxIcon({ width = 34, height = 30 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 56 48" fill="none">
      {/* Gold four-point sparkle */}
      <Path
        d="M14 3.5 L15.1 7.2 L14 10.9 L12.9 7.2 Z"
        fill={choremaxxBrand.gold}
      />
      <Path
        d="M10.2 7.2 L14 8.3 L17.8 7.2 L14 6.1 Z"
        fill={choremaxxBrand.gold}
      />
      {/* Cyan roof chevron */}
      <Path
        d="M10 22 L28 6 L46 22"
        stroke={choremaxxBrand.cyan}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Mint ribbon / folded base */}
      <Path
        d="M12 26 C18 22 24 22 28 26 C32 30 38 30 44 26 C42 34 38 40 28 42 C18 40 14 34 12 26 Z"
        fill={choremaxxBrand.mint}
      />
      <Path
        d="M16 28 C22 25 26 26 28 29 C30 32 34 33 40 30"
        stroke="rgba(7,13,28,0.18)"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Compact brand badge for headers / nav. */
export function ChoremaxxBadge({
  showWordmark = true,
  size = 'md',
}: {
  showWordmark?: boolean;
  /** `sm` for dense chips; `md` default; `lg` for home/hero headers. */
  size?: 'sm' | 'md' | 'lg';
}) {
  const scale =
    size === 'lg' ? { iconW: 22, iconH: 19, text: 16, x: 15.5, gap: 7 } : size === 'sm'
      ? { iconW: 16, iconH: 14, text: 12.5, x: 12, gap: 5 }
      : { iconW: 18, iconH: 16, text: 14, x: 13.5, gap: 6 };

  return (
    <View
      style={[styles.badge, { gap: scale.gap }]}
      accessibilityRole="image"
      accessibilityLabel="Choremaxx">
      <ChoremaxxIcon width={scale.iconW} height={scale.iconH} />
      {showWordmark ? (
        <View style={styles.badgeWord}>
          <Text style={[styles.badgeChorema, { fontSize: scale.text }]}>chorema</Text>
          <Text style={[styles.badgeX, { fontSize: scale.x }]}>x</Text>
          <Text style={[styles.badgeXFaded, { fontSize: scale.x }]}>x</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  badgeChorema: {
    color: choremaxxBrand.cyan,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  badgeWord: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  badgeX: {
    color: choremaxxBrand.slate,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  badgeXFaded: {
    color: choremaxxBrand.faded,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.8,
    opacity: 0.85,
  },
  chorema: {
    color: choremaxxBrand.cyan,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  wordRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  xFaded: {
    color: choremaxxBrand.faded,
    fontWeight: '700',
    letterSpacing: -1.1,
    opacity: 0.9,
  },
  xPrimary: {
    color: choremaxxBrand.slate,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
});
