import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

/** Late credit XP table from constants.lateCredit + xpValues. */
export function LateCreditTable({ constants, palette, voice }: VisualWidgetProps) {
  const rows = constants.xpValues.map((full) => ({
    full,
    late: constants.lateCredit[String(full)] ?? Math.round(full * 0.8),
  }));

  return (
    <View style={[styles.table, { borderColor: palette.cardBorder }]} accessibilityRole="summary">
      <View style={[styles.row, styles.head, { backgroundColor: palette.pillBg }]}>
        <Text style={[typography.caption2, styles.cell, { color: palette.pillText, fontWeight: '700' }]}>
          {voice === 'kid' ? 'On time' : 'Full'}
        </Text>
        <Text style={[typography.caption2, styles.cell, { color: palette.pillText, fontWeight: '700' }]}>
          {voice === 'kid' ? 'A bit late' : 'Late Credit'}
        </Text>
      </View>
      {rows.map((r) => (
        <View key={r.full} style={[styles.row, { borderTopColor: palette.cardBorder }]}>
          <Text style={[typography.footnote, styles.cell, { color: palette.ink }]}>{r.full}</Text>
          <Text style={[typography.footnote, styles.cell, { color: palette.warn, fontWeight: '600' }]}>
            {r.late}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  head: {},
  row: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
