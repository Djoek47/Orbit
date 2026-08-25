import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import Icon from '@/components/orbit/design/Icon';
import { domainIconName } from '@/components/orbit/design/icon-map';
import { radius } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type IuiDomainTile = {
  id: string;
  label: string;
};

type Props = {
  domains: IuiDomainTile[];
  selectedId?: string;
  accent: string;
  onSelect?: (id: string) => void;
  /** When Poppins already narrowed to Kitchen, show that tile alone. */
  narrow?: boolean;
};

/** Assign-style category grid, driven by AIUIC (not a dumped human form). */
export function IuiDomainGrid({ domains, selectedId, accent, onSelect, narrow }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const shown = narrow && selectedId ? domains.filter((d) => d.id === selectedId) : domains;
  return (
    <View style={[styles.grid, narrow && shown.length === 1 ? styles.narrow : null]}>
      {shown.map((domain) => {
        const selected = domain.id === selectedId;
        return (
          <Animated.View key={domain.id} entering={FadeIn.duration(220)} style={styles.cell}>
            <Pressable
              onPress={() => onSelect?.(domain.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={domain.label}
              style={[
                styles.tile,
                {
                  backgroundColor: selected ? `${accent}18` : glass(0.06),
                  borderColor: selected ? accent : glassBorder(0.1),
                },
              ]}>
              <Icon name={domainIconName(domain.id)} size={26} />
              <Text style={[styles.label, { color: c.text }]} numberOfLines={2}>
                {domain.label}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  narrow: { justifyContent: 'center' },
  cell: { width: '22%', minWidth: 72, maxWidth: 88, flexGrow: 1 },
  tile: {
    alignItems: 'center',
    aspectRatio: 1,
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    justifyContent: 'center',
    padding: 6,
  },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
