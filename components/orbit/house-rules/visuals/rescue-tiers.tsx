import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';

/** Three tiles from constants.streakRescue. */
export function RescueTiers({ constants, palette, voice }: VisualWidgetProps) {
  const r = constants.streakRescue;
  const one = `${Math.round(r.afterOneMiss * 100)}%`;
  const two = `${Math.round(r.afterTwoConsecutive * 100)}%`;

  if (voice === 'sidekick') {
    const tiles = [
      { key: '1', label: `1 day → ${one}` },
      { key: '2', label: `2 days → ${two}` },
      { key: '3', label: '3 days → gone' },
    ];
    return (
      <View style={styles.pills} accessible={false} importantForAccessibility="no-hide-descendants">
        {tiles.map((tile) => (
          <View key={tile.key} style={[styles.pill, { backgroundColor: palette.cardBorder }]}>
            <Text style={[styles.pillText, { color: palette.pillText }]}>{tile.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  const tiles = [
    { key: '1', value: one, cap: 'after one\nmissed day', gone: false },
    { key: '2', value: two, cap: 'after two\nin a row', gone: false },
    { key: '3', value: 'Lost', cap: 'after three\nin a row', gone: true },
  ];

  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {tiles.map((tile) => (
        <View key={tile.key} style={[styles.tile, { backgroundColor: palette.deep }]}>
          <Text style={[styles.value, { color: tile.gone ? '#E07A63' : palette.warn }]}>{tile.value}</Text>
          <Text style={[styles.cap, { color: palette.muted }]}>{tile.cap}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 10 },
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
  cap: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 3,
    textAlign: 'center',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
    marginBottom: 10,
  },
  pill: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
});
