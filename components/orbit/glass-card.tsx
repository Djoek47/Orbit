import { PropsWithChildren, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius } from '@/constants/orbit-theme';
import { glassBorder, glassFill } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type GlassCardProps = PropsWithChildren<{
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Make card chrome — Day/Night glass via orbitPalette. */
export function GlassCard({ children, elevated = false, style }: GlassCardProps) {
  const orbit = useOrbitOptional();
  const colors = useMemo(() => {
    const palette = orbit?.orbitPalette;
    const isDark = palette?.isDark ?? true;
    const accent = orbit?.accentTheme.primary ?? '#59B2E1';
    return {
      card: palette?.card ?? glassFill(isDark, 0.05),
      border: palette?.border ?? glassBorder(isDark, 0.1),
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
