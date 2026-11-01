/**
 * Maps app mark — WO14 §5.
 * Brand files in `assets/maps/` (apple-maps / google-maps / waze / autonav).
 */
import { Image, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type MapsAppMarkId = 'apple' | 'google' | 'waze';

const MARK: Record<
  MapsAppMarkId | 'auto',
  { source: number; label: string; letter: string }
> = {
  auto: {
    source: require('@/assets/maps/autonav.png'),
    label: 'AutoNav',
    letter: 'A',
  },
  apple: {
    source: require('@/assets/maps/apple-maps.png'),
    label: 'Apple Maps',
    letter: 'A',
  },
  google: {
    source: require('@/assets/maps/google-maps.png'),
    label: 'Google Maps',
    letter: 'G',
  },
  waze: {
    source: require('@/assets/maps/waze.png'),
    label: 'Waze',
    letter: 'W',
  },
};

export function mapsAppMarkLabel(app: MapsAppMarkId | 'auto'): string {
  return MARK[app].label;
}

export function MapsAppMark({
  app,
  size = 18,
}: {
  app: MapsAppMarkId | 'auto';
  size?: number;
  /** @deprecated Assets are shipped — kept for call-site compat. */
  forceNeutral?: boolean;
}) {
  const { glassBorder, isDark } = useOrbitColors();
  const mark = MARK[app];
  const radius = Math.max(4, size / 5);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: glassBorder(0.12),
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.04)',
        },
      ]}
      accessibilityLabel={mark.label}>
      <Image
        source={mark.source}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** Fallback letter tile if an asset ever fails to resolve (tests / storybook). */
export function MapsAppMarkLetter({
  app,
  size = 18,
}: {
  app: MapsAppMarkId | 'auto';
  size?: number;
}) {
  const { c, glassBorder, isDark } = useOrbitColors();
  return (
    <View
      style={[
        styles.neutral,
        {
          width: size,
          height: size,
          borderRadius: size / 5,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.06)',
          borderColor: glassBorder(0.12),
        },
      ]}>
      <Text style={[styles.letter, { color: c.textMuted, fontSize: Math.max(9, size * 0.4) }]}>
        {MARK[app].letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  neutral: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  letter: { fontWeight: '700' },
});
