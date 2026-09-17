import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
  /** @deprecated House SVG is always used. Kept for API compat. */
  useBrandMark?: boolean;
};

function useBrandLockup(): BrandLockupColors {
  const orbit = useOrbitOptional();
  return resolveBrandLockup(orbit?.accentTheme.id, orbit?.orbitPalette.isDark ?? false);
}

/**
 * Official Choremaxx lockup: themed house mark + “chore” (secondary) + “maxx” (primary).
 *
 * OPEN DECISION (Bricolage migration): the live wordmark Text is intentionally
 * left on the system / StyleSheet weight path for now — do not silently convert
 * to Bricolage. Product will decide whether the wordmark stays a locked asset
 * and Bricolage handles only UI chrome.
 */
export function ChoremaxxLogo({
  size = 'md',
  variant = 'full',
  style,
}: ChoremaxxLogoProps) {
  const lockup = useBrandLockup();
  const { iconH, textSize, gap } = SIZES[size];
  const iconW = iconH * 1.15;

  return (
    <View style={[styles.row, { gap }, style]} accessibilityRole="image" accessibilityLabel="Choremaxx">
      {variant === 'full' || variant === 'icon' ? (
        <ChoremaxxIcon width={iconW} height={iconH} colors={lockup} />
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

type IconProps = {
  width?: number;
  height?: number;
  colors?: BrandLockupColors;
};

/**
 * Classic Choremaxx house mark — sparkle + roof + body, recolored per palette.
 */
export function ChoremaxxIcon({ width = 34, height = 30, colors }: IconProps) {
  const live = useBrandLockup();
  const c = colors ?? live;

  return (
    <Svg width={width} height={height} viewBox="0 0 56 48" fill="none">
      {/* Sparkle */}
      <Path d="M14 3.5 L15.1 7.2 L14 10.9 L12.9 7.2 Z" fill={c.sparkle} />
      <Path d="M10.2 7.2 L14 8.3 L17.8 7.2 L14 6.1 Z" fill={c.sparkle} />
      {/* Roof */}
      <Path
        d="M10 22 L28 6 L46 22"
        stroke={c.roof}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Body */}
      <Path
        d="M12 26 C18 22 24 22 28 26 C32 30 38 30 44 26 C42 34 38 40 28 42 C18 40 14 34 12 26 Z"
        fill={c.body}
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

/** @deprecated Alias — house mark is the only brand mark. */
export function ChoremaxxMark(props: IconProps) {
  return <ChoremaxxIcon {...props} />;
}

/** Compact brand badge for headers / nav — themed house + chore/maxx. */
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
      ? { iconW: 44, iconH: 38, text: 26, gap: 11 }
      : size === 'lg'
        ? { iconW: 34, iconH: 30, text: 20, gap: 9 }
        : size === 'sm'
          ? { iconW: 18, iconH: 16, text: 12.5, gap: 5 }
          : { iconW: 26, iconH: 23, text: 16, gap: 7 };

  return (
    <View
      style={[styles.badge, { gap: scale.gap }]}
      accessibilityRole="image"
      accessibilityLabel="Choremaxx">
      <ChoremaxxIcon width={scale.iconW} height={scale.iconH} colors={lockup} />
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
