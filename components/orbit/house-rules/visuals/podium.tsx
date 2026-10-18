import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { HR } from '@/lib/rules/house-rules-palette';

/** Crown podium. Place numerals are decorative — hidden from VoiceOver. */
export function Podium({ palette, voice }: VisualWidgetProps) {
  const fills =
    voice === 'sidekick'
      ? [HR.silver, palette.warn, HR.skBronze]
      : [HR.silver, palette.warn, HR.bronze];
  const heights = voice === 'sidekick' ? [0.68, 1, 0.5] : [0.7, 1, 0.52];
  const labels = voice === 'sidekick' ? ['2', '1', '3'] : ['2nd', '1st', '3rd'];
  const max = voice === 'sidekick' ? 84 : 70;

  return (
    <View
      style={[styles.row, { height: max }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {heights.map((ratio, i) => (
        <View key={labels[i]} style={[styles.col, { height: max }]}>
          <Text style={[styles.label, { color: voice === 'sidekick' ? palette.surface : '#C9D6E8' }]}>
            {labels[i]}
          </Text>
          <View
            style={[
              styles.bar,
              {
                height: max * ratio,
                backgroundColor: fills[i],
                borderTopLeftRadius: voice === 'sidekick' ? 10 : 7,
                borderTopRightRadius: voice === 'sidekick' ? 10 : 7,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 18,
  },
  col: {
    flex: 1,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    position: 'absolute',
    top: -17,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  bar: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 4,
  },
});
