import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  COLOR_PALETTES,
  type ColorPaletteId,
} from '@/constants/color-palettes';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type PaletteWheelProps = {
  value: ColorPaletteId;
  onChange: (id: ColorPaletteId) => void;
  /** Compact swatches for household default. */
  size?: 'regular' | 'compact';
  label?: string;
};

/**
 * Circular-feeling palette picker — ring of gradient swatches.
 * Each palette owns its own day/night surfaces; mode is chosen separately.
 */
export function PaletteWheel({
  value,
  onChange,
  size = 'regular',
  label = 'Color',
}: PaletteWheelProps) {
  const { orbitPalette } = useOrbit();
  const swatch = size === 'compact' ? 40 : 48;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: orbitPalette.textMuted }]}>{label}</Text>
      ) : null}
      <View style={styles.wheel}>
        {COLOR_PALETTES.map((palette) => {
          const active = value === palette.id;
          return (
            <Pressable
              key={palette.id}
              style={styles.item}
              onPress={() => onChange(palette.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${palette.label} palette`}>
              <LinearGradient
                colors={[palette.swatch.primary, palette.swatch.secondary]}
                style={[
                  styles.swatch,
                  {
                    width: swatch,
                    height: swatch,
                    borderRadius: swatch / 2,
                  },
                  active && {
                    borderColor: palette.swatch.primary,
                    borderWidth: 2.5,
                    shadowColor: palette.swatch.primary,
                    shadowOpacity: 0.45,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 4,
                  },
                ]}>
                {active ? <MaterialIcons name="check" size={size === 'compact' ? 14 : 18} color="#fff" /> : null}
              </LinearGradient>
              <Text
                style={[
                  styles.caption,
                  { color: active ? palette.swatch.primary : orbitPalette.textSubtle },
                  active && { fontWeight: '700' },
                ]}>
                {palette.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: orbitPalette.textFaint }]}>
        Each color has Day and Night versions
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: {
    ...typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wheel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    justifyContent: 'flex-start',
  },
  item: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
  },
  hint: {
    ...typography.caption2,
    marginTop: 2,
  },
});
