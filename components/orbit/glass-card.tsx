import { PropsWithChildren, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { orbitColors, radius } from '@/constants/orbit-theme';
import { useOrbitOptional } from '@/store/orbit-store';

type GlassCardProps = PropsWithChildren<{
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Make card chrome — follows orbitPalette for light/dark + background packs. */
export function GlassCard({ children, elevated = false, style }: GlassCardProps) {
  const orbit = useOrbitOptional();
  const colors = useMemo(() => {
    const palette = orbit?.orbitPalette;
    const accent = orbit?.accentTheme.primary ?? orbitColors.primary;
    return {
      card: palette?.card ?? orbitColors.card,
      border: palette?.border ?? orbitColors.border,
      elevatedBg: `${accent}14`,
      elevatedBorder: `${accent}2E`,
    };
  }, [orbit?.orbitPalette, orbit?.accentTheme.primary]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        elevated && {
          backgroundColor: colors.elevatedBg,
          borderColor: colors.elevatedBorder,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    width: '100%',
  },
});
