import { StyleSheet, View } from 'react-native';

import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { HR } from '@/lib/rules/house-rules-palette';

/** Streak window dots from constants.streak. Adult: rolling window. Sidekick: consecutive lives. */
export function StreakDots({ constants, palette, voice }: VisualWidgetProps) {
  const total =
    voice === 'kid' ? constants.streak.consecutiveMissesToEnd : constants.streak.rollingWindowDays;
  const filled = Math.max(0, constants.streak.consecutiveMissesToEnd - 1);

  return (
    <View
      style={[styles.row, voice === 'kid' ? styles.kidRow : null]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => {
        const miss = i < filled;
        if (voice === 'kid') {
          return (
            <View
              key={i}
              style={[
                styles.kidDot,
                { backgroundColor: miss ? palette.danger : palette.cardBorder },
              ]}
            />
          );
        }
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: miss ? HR.missFill : 'transparent',
                borderColor: miss ? HR.missFill : '#4E6389',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 7, marginTop: 13 },
  kidRow: { alignItems: 'center', gap: 8, marginTop: 12 },
  dot: {
    borderRadius: 99,
    borderWidth: 2,
    height: 13,
    width: 13,
  },
  kidDot: {
    borderRadius: 8,
    height: 22,
    width: 22,
  },
});
