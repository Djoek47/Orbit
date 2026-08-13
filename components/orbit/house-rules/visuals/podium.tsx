import { StyleSheet, View } from 'react-native';

import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { HR } from '@/lib/rules/house-rules-palette';

/** Crown podium. Place numerals are decorative — hidden from VoiceOver. */
export function Podium({ palette, voice }: VisualWidgetProps) {
  const fills =
    voice === 'kid'
      ? [HR.silver, palette.warn, HR.kidBronze]
      : [HR.silver, palette.warn, HR.bronze];
  const heights = [0.7, 1, 0.52];
  const max = voice === 'kid' ? 84 : 70;

  return (
    <View
      style={[styles.row, { height: max }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {heights.map((ratio, i) => (
        <View key={i} style={[styles.bar, { height: max * ratio, backgroundColor: fills[i] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    marginTop: 14,
  },
  bar: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    flex: 1,
  },
});
