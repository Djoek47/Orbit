import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { resolveBrandLockup, type BrandLockupColors } from '@/constants/brand-lockup';
import { useOrbitOptional } from '@/store/orbit-store';

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
  /** @deprecated SVG mark is always used for theme recolor. Kept for API compat. */
  useBrandMark?: boolean;
};

function useBrandLockup(): BrandLockupColors {
  const orbit = useOrbitOptional();
  return resolveBrandLockup(orbit?.accentTheme.id, orbit?.orbitPalette.isDark ?? false);
}

/**
 * Official Choremaxx lockup: theme mark + wordmark “chore” + “maxx”
 * (maxx matches active palette primary — logo directions blue-arrow rule).
 */
export function ChoremaxxLogo({
  size = 'md',
  variant = 'full',
  style,
}: ChoremaxxLogoProps) {
  const lockup = useBrandLockup();
  const { iconH, textSize, gap } = SIZES[size];
  const iconW = iconH;

  return (
    <View style={[styles.row, { gap }, style]} accessibilityRole="image" accessibilityLabel="Choremaxx">
      {variant === 'full' || variant === 'icon' ? (
        <ChoremaxxMark width={iconW} height={iconH} colors={lockup} />
      ) : null}
      {variant === 'full' || variant === 'wordmark' ? (
        <Wordmark fontSize={textSize} chore={lockup.chore} maxx={lockup.maxx} />
      ) : null}
    </View>
  );
}

function Wordmark({
  fontSize,
  chore,
  maxx,
}: {
  fontSize: number;
  chore: string;
  maxx: string;
}) {
  return (
    <View style={styles.wordRow}>
      <Text style={[styles.wordPart, { fontSize, lineHeight: fontSize * 1.1, color: chore }]}>
        chore
      </Text>
      <Text style={[styles.wordPart, { fontSize, lineHeight: fontSize * 1.1, color: maxx }]}>
        maxx
      </Text>
    </View>
  );
}

type MarkProps = {
  width?: number;
  height?: number;
  colors?: BrandLockupColors;
};

/**
 * Uniform Choremaxx mark — rounded square, checkmark, rising bars.
 * Pass `colors` or inherit from the active palette.
 */
export function ChoremaxxMark({ width = 34, height = 34, colors }: MarkProps) {
  const live = useBrandLockup();
  const c = colors ?? live;

  return (
    <Svg width={width} height={height} viewBox="0 0 64 64" fill="none">
      <Rect x="0" y="0" width="64" height="64" rx="14" fill={c.markBg} />
      {/* Checkmark */}
      <Path
        d="M18 31.5 L27.5 41 L46.5 20.5"
        stroke={c.check}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Rising bars */}
      <Rect x="18" y="46" width="7" height="10" rx="2" fill={c.bars} />
      <Rect x="28.5" y="41" width="7" height="15" rx="2" fill={c.bars} />
      <Rect x="39" y="35" width="7" height="21" rx="2" fill={c.bars} />
    </Svg>
  );
}

/** @deprecated Prefer ChoremaxxMark — kept so BrandOpening / success screens compile. */
export function ChoremaxxIcon({ width = 34, height = 30, colors }: MarkProps) {
  const size = Math.max(width, height);
  return <ChoremaxxMark width={size} height={size} colors={colors} />;
}

/** Compact brand badge for headers / nav — theme mark + chore/maxx. */
export function ChoremaxxBadge({
  showWordmark = true,
  size = 'md',
}: {
  showWordmark?: boolean;
  /** `sm` dense · `md` default · `lg` headers · `xl` home (~27% larger than lg). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const lockup = useBrandLockup();
  const scale =
    size === 'xl'
      ? { icon: 40, text: 26, gap: 11 }
      : size === 'lg'
        ? { icon: 32, text: 20, gap: 9 }
        : size === 'sm'
          ? { icon: 18, text: 12.5, gap: 5 }
          : { icon: 26, text: 16, gap: 7 };

  return (
    <View
      style={[styles.badge, { gap: scale.gap }]}
      accessibilityRole="image"
      accessibilityLabel="Choremaxx">
      <ChoremaxxMark width={scale.icon} height={scale.icon} colors={lockup} />
      {showWordmark ? (
        <Wordmark fontSize={scale.text} chore={lockup.chore} maxx={lockup.maxx} />
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
  wordPart: {
    fontWeight: '700',
    letterSpacing: -0.45,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  wordRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
});
