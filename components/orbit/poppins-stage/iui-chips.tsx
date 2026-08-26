import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import Icon from '@/components/orbit/design/Icon';
import { domainIconName } from '@/components/orbit/design/icon-map';
import type { IuiChip } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  chips: IuiChip[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  accent: string;
  showEmoji?: boolean;
  showIcons?: boolean;
};

export function IuiChips({
  chips,
  selectedId,
  onSelect,
  accent,
  showEmoji = true,
  showIcons = false,
}: Props) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const selected = chip.id === selectedId;
        const icon = showIcons
          ? (() => {
              try {
                return domainIconName(chip.id);
              } catch {
                return null;
              }
            })()
          : null;
        return (
          <View key={chip.id}>
            <Pressable
              onPress={() => onSelect?.(chip.id)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? `${accent}99` : glassBorder(0.1),
                  backgroundColor: selected ? `${accent}22` : 'transparent',
                },
              ]}>
              {icon ? <Icon name={icon} size={22} /> : null}
              {showEmoji && chip.emoji && !icon ? <Text style={styles.emoji}>{chip.emoji}</Text> : null}
              <Text style={[styles.label, { color: c.text }]}>{chip.label}</Text>
            </Pressable>
          </View>
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
