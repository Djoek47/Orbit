import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

/** Streak window dots from constants.streak. */
export function StreakDots({ constants, palette, voice }: VisualWidgetProps) {
  const days = constants.streak.rollingWindowDays;
  const missLimit = constants.streak.missesInWindowToEnd;
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.row}>
        {Array.from({ length: days }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < days - missLimit + 1 ? palette.success : palette.pillBg,
                borderColor: palette.cardBorder,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[typography.caption2, { color: palette.muted, marginTop: 6 }]}>
        {voice === 'kid'
          ? `${missLimit} misses in ${days} days ends the streak`
          : `${missLimit} misses in a ${days}-day window ends the streak`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  row: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
