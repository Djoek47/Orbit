import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import type { IuiChip } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  chips: IuiChip[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  accent: string;
};

export function IuiChips({ chips, selectedId, onSelect, accent }: Props) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View style={styles.row}>
      {chips.slice(0, 3).map((chip) => {
        const selected = chip.id === selectedId;
        return (
          <Animated.View key={chip.id} entering={FadeIn.duration(220)}>
            <Pressable
              onPress={() => onSelect?.(chip.id)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? `${accent}99` : glassBorder(0.1),
                  backgroundColor: selected ? `${accent}22` : 'transparent',
                },
              ]}>
              {chip.emoji ? <Text style={styles.emoji}>{chip.emoji}</Text> : null}
              <Text style={[styles.label, { color: c.text }]}>{chip.label}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  emoji: { fontSize: 16 },
  label: { fontSize: 15, fontWeight: '500' },
});
