import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

/** Reward model list from constants.rewardModels. */
export function ModelList({ constants, palette, voice }: VisualWidgetProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {constants.rewardModels.map((m) => (
        <View key={m.key} style={[styles.chip, { backgroundColor: palette.chipBg }]}>
          <Text style={[typography.caption1, { color: palette.ink, fontWeight: '600' }]}>
            {voice === 'kid' ? m.label.replace('XP', 'points') : m.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
