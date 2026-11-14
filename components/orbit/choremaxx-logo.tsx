import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSeasonal } from '@/lib/theme/seasonal';

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
  // Seasons: same mark, plus a hat on the roof — witch hat (Halloween), Santa hat (Christmas)
  // or a maple leaf (Thanksgiving). Off = untouched.
  const { active } = useSeasonal();
  const halloween = active === 'halloween';
  const christmas = active === 'christmas';
  const thanksgiving = active === 'thanksgiving';

  return (
    <Svg width={width} height={height} viewBox={halloween || christmas || thanksgiving ? '0 -5 56 53' : '0 0 56 48'} fill="none">
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
      {halloween ? (
        <>
          <Path d="M23.5 6 L32.5 6 L31 -1 L34 -4.5 L29.5 -3.5 L26.5 0 Z" fill="#6842AA" />
          <Path d="M18.5 6.4 C22 4.6 34 4.6 37.5 6.4 C34 8 22 8 18.5 6.4 Z" fill="#6842AA" />
          <Path d="M23.7 4.3 L32.3 4.3 L32.5 6 L23.5 6 Z" fill="#FF9A2E" />
          <Path d="M24.6 33.2 a1.1 1.3 0 1 0 0.01 0 Z M31.4 33.2 a1.1 1.3 0 1 0 0.01 0 Z" fill="#2A1747" />
          <Path d="M26.4 36.6 Q28 37.8 29.6 36.6" stroke="#2A1747" strokeWidth={0.9} strokeLinecap="round" fill="none" />
        </>
      ) : null}
      {christmas ? (
        <>
          {/* Santa hat: red cone flopping right, white brim, pompom. */}
          <Path d="M21 6.2 C22 -1.5 30 -4.5 35.5 -1 C37.6 0.4 38.6 2.4 38.8 4.6 L35.6 4.2 C35 2.2 33.6 1.2 32 1.4 L34.6 6.2 Z" fill="#E5484D" />
          <Path d="M19.5 6.6 C24 4.4 32 4.4 36.5 6.6 C36.6 8.2 36 8.6 34.8 8.6 C30 7.4 26 7.4 21.2 8.6 C20 8.6 19.4 8.2 19.5 6.6 Z" fill="#FFFFFF" />
          <Path d="M39 4.4 a2 2 0 1 0 0.01 0 Z" fill="#FFFFFF" />
        </>
      ) : null}
      {thanksgiving ? (
        <Path
          d="M28 7 L28 4 L27.3 4.4 L24.7 3.7 L25.2 2.7 L22.9 0.8 L24 0.4 L23.5 -1.4 L25.2 -0.9 L25.5 -1.8 L26.8 -0.2 L26.4 -2.8 L27.3 -2.4 L28 -4.2 L28.7 -2.4 L29.6 -2.8 L29.2 -0.2 L30.5 -1.8 L30.8 -0.9 L32.5 -1.4 L32 0.4 L33.1 0.8 L30.8 2.7 L31.3 3.7 L28.7 4.4 L28 4 Z"
          fill="#E8703F"
        />
      ) : null}
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
