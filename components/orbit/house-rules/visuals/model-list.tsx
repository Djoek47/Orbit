import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';

/** Five rows from constants.rewardModels; household active model highlighted. Sidekick: empty. */
export function ModelList({ constants, palette, voice, activeRewardModel }: VisualWidgetProps) {
  if (voice === 'sidekick') return null;
  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      {constants.rewardModels.map((model) => {
        const on = model.key === activeRewardModel;
        return (
          <View
            key={model.key}
            style={[
              styles.row,
              {
                backgroundColor: on ? palette.warn : palette.deep,
              },
            ]}>
            <Text
              style={[
                styles.label,
                { color: on ? palette.surface : '#C9D6E8', fontWeight: on ? '700' : '600' },
              ]}>
              {model.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'column', gap: 6, marginTop: 14, marginBottom: 10 },
  row: {
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  label: { fontSize: 12.5 },
});
