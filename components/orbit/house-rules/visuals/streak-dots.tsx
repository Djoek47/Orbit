import { StyleSheet, View } from 'react-native';

import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { HR } from '@/lib/rules/house-rules-palette';

/** Streak window dots from constants.streak. */
export function StreakDots({ constants, palette, voice }: VisualWidgetProps) {
  const total =
    voice === 'sidekick' ? constants.streak.consecutiveMissesToEnd : constants.streak.rollingWindowDays;
  const filled =
    voice === 'sidekick'
      ? Math.max(0, constants.streak.consecutiveMissesToEnd - 1)
      : Math.max(0, constants.streak.missesInWindowToEnd - 1);

  return (
    <View
      style={[styles.row, voice === 'sidekick' ? styles.kidRow : null]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => {
        const miss = i < filled;
        if (voice === 'sidekick') {
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
  row: { flexDirection: 'row', gap: 7, marginTop: 14, marginBottom: 10 },
  kidRow: { alignItems: 'center', gap: 8 },
  dot: {
    borderRadius: 99,
    borderWidth: 2,
    height: 13,
    width: 13,
  },
  kidDot: {
    borderRadius: 8,
    height: 24,
    width: 24,
  },
});
