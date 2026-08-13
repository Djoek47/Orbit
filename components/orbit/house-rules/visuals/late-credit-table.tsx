import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { VOCAB } from '@/constants/vocabulary';

/** XP reduction table from constants.lateCredit — pills, table, or Sidekick swap chips. */
export function LateCreditTable({ constants, palette, voice, variant = 'table' }: VisualWidgetProps) {
  const rows = constants.xpValues.map((full) => {
    const late = constants.lateCredit[String(full)];
    if (typeof late !== 'number') {
      throw new Error(`house-rules visual: lateCredit missing for ${full}`);
    }
    return { full, late };
  });

  if (voice === 'kid' || variant === 'pills') {
    return (
      <View style={styles.pills} accessible={false} importantForAccessibility="no-hide-descendants">
        {rows.map((row) => (
          <View
            key={row.full}
            style={[
              styles.pill,
              { backgroundColor: voice === 'kid' ? palette.cardBorder : palette.pillBg },
            ]}>
            <Text style={[styles.pillText, { color: palette.pillText }]}>
              {row.full}
              {' → '}
              <Text style={{ color: voice === 'kid' ? palette.warn : palette.success, fontWeight: '800' }}>
                {row.late}
              </Text>
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
          <Text style={[styles.td, { color: palette.muted }]}>
            {row.full} · {VOCAB.lateCredit}
          </Text>
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
    gap: 6,
    marginTop: 10,
  },
  pill: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  table: { marginTop: 12, width: '100%' },
  tr: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  td: { fontSize: 13.5, fontVariant: ['tabular-nums'] },
  tdRight: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '700' },
});
