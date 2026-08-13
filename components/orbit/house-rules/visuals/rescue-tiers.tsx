import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';

/** Three tiles from constants.streakRescue. */
export function RescueTiers({ constants, palette }: VisualWidgetProps) {
  const r = constants.streakRescue;
  const one = `${Math.round(r.afterOneMiss * 100)}%`;
  const two = `${Math.round(r.afterTwoConsecutive * 100)}%`;
  const third = r.thirdConsecutive;

  const tiles = [
    { key: '1', value: one, gone: false },
    { key: '2', value: two, gone: false },
    { key: '3', value: third.replace(/_/g, ' '), gone: true },
  ];

  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {tiles.map((tile) => (
        <View key={tile.key} style={[styles.tile, { backgroundColor: palette.surface }]}>
          <Text
            style={[
              styles.value,
              { color: tile.gone ? palette.danger : palette.warn },
            ]}>
            {tile.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 13 },
  tile: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  value: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
});
