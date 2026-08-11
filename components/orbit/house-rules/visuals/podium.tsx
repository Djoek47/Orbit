import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

/** Crown podium — top trophy from constants. */
export function Podium({ constants, palette, voice }: VisualWidgetProps) {
  const trophy = constants.topTrophy;
  const heights = [56, 78, 48];
  const places = voice === 'kid' ? ['2', '1', '3'] : ['2nd', '1st', '3rd'];

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.row}>
        {heights.map((h, i) => (
          <View key={places[i]} style={styles.col}>
            <View
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: i === 1 ? palette.warn : palette.pillBg,
                  borderColor: palette.cardBorder,
                },
              ]}>
              <Text style={[typography.caption2, { color: i === 1 ? palette.ink : palette.muted }]}>
                {places[i]}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[typography.caption1, { color: palette.inkSoft, textAlign: 'center', marginTop: 8 }]}>
        {trophy.name}
        {voice === 'adult' ? ` · ${trophy.xp.toLocaleString()} XP` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  col: { alignItems: 'center', width: 56 },
  bar: {
    width: 48,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
});
