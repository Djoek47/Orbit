/**
 * Maps app mark — WO14 §5.
 * Official brand files belong in `assets/maps/` (apple-maps / google-maps / waze).
 * Until those land, Settings tiles use a neutral letter square.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type MapsAppMarkId = 'apple' | 'google' | 'waze';

const LETTER: Record<MapsAppMarkId | 'auto', string> = {
  auto: 'A',
  apple: 'A',
  google: 'G',
  waze: 'W',
};

export function MapsAppMark({
  app,
  size = 18,
}: {
  app: MapsAppMarkId | 'auto';
  size?: number;
  /** @deprecated WO14 — always neutral until assets/maps/ official files land. */
  forceNeutral?: boolean;
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
      ]}
      accessibilityLabel={
        app === 'auto'
          ? 'Auto'
          : app === 'apple'
            ? 'Apple Maps'
            : app === 'google'
              ? 'Google Maps'
              : 'Waze'
      }>
      <Text style={[styles.letter, { color: c.textMuted, fontSize: Math.max(9, size * 0.4) }]}>
        {LETTER[app]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  neutral: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  letter: { fontWeight: '700' },
});
