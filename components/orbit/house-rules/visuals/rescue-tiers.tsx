import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

/** Rescue cost tiers from constants.streakRescue. */
export function RescueTiers({ constants, palette, voice }: VisualWidgetProps) {
  const r = constants.streakRescue;
  const tiers = [
    {
      key: '1',
      label: voice === 'kid' ? 'After 1 miss' : 'After one miss',
      value:
        r.afterOneMiss === 0
          ? voice === 'kid'
            ? 'Free'
            : '0%'
          : `${Math.round(r.afterOneMiss * 100)}%`,
    },
    {
      key: '2',
      label: voice === 'kid' ? 'After 2 misses' : 'After two consecutive',
      value: `${Math.round(r.afterTwoConsecutive * 100)}%`,
    },
    {
      key: '3',
      label: voice === 'kid' ? 'Third miss' : 'Third consecutive',
      value:
        r.thirdConsecutive === 'PERMANENT_LOSS'
          ? voice === 'kid'
            ? 'Gone'
            : 'Permanent loss'
          : r.thirdConsecutive,
    },
  ];
  if (typeof r.monthlyToken === 'number') {
    tiers.unshift({
      key: 'token',
      label: voice === 'kid' ? 'Rescue token' : 'Monthly rescue token',
      value: String(r.monthlyToken),
    });
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {tiers.map((t) => (
        <View key={t.key} style={[styles.row, { backgroundColor: palette.pillBg }]}>
          <Text style={[typography.caption1, { color: palette.inkSoft, flex: 1 }]}>{t.label}</Text>
          <Text style={[typography.footnote, { color: palette.pillText, fontWeight: '700' }]}>
            {t.value}
          </Text>
        </View>
      ))}
      <Text style={[typography.caption2, { color: palette.muted, marginTop: 4 }]}>
        {voice === 'kid'
          ? 'Charged from this week’s points'
          : `Charged against ${r.chargedAgainst.replace(/_/g, ' ').toLowerCase()}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
