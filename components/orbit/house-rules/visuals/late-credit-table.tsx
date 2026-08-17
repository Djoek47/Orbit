import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';

/** XP reduction table from constants.lateCredit. */
export function LateCreditTable({ constants, palette, voice }: VisualWidgetProps) {
  const rows = constants.xpValues.map((full) => {
    const late = constants.lateCredit[String(full)];
    if (typeof late !== 'number') {
      throw new Error(`house-rules visual: lateCredit missing for ${full}`);
    }
    return { full, late };
  });

  if (voice === 'sidekick') {
    return (
      <View style={styles.pills} accessible={false} importantForAccessibility="no-hide-descendants">
        {rows.map((row) => (
          <View key={row.full} style={[styles.pill, { backgroundColor: palette.cardBorder }]}>
            <Text style={[styles.pillText, { color: palette.pillText }]}>
              {row.full}
              {' → '}
              <Text style={{ color: palette.warn, fontWeight: '800' }}>{row.late}</Text>
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table} accessible={false} importantForAccessibility="no-hide-descendants">
      {rows.map((row) => (
        <View key={row.full} style={[styles.tr, { borderBottomColor: palette.quietBorder }]}>
          <Text style={[styles.td, { color: palette.muted }]}>{row.full} XP task</Text>
          <Text style={[styles.tdRight, { color: palette.warn }]}>{row.late}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
  table: { marginTop: 14, width: '100%' },
  tr: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  td: { fontSize: 13.5, fontVariant: ['tabular-nums'] },
  tdRight: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '700' },
});
