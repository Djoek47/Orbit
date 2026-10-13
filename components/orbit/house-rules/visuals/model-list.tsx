import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';

/**
 * Five rows from constants.rewardModels, the household's own highlighted. An admin taps a
 * row to switch — it's the rule and the control in one. Sidekick: empty.
 */
export function ModelList({
  constants,
  palette,
  voice,
  activeRewardModel,
  onSelectRewardModel,
}: VisualWidgetProps) {
  if (voice === 'sidekick') return null;
  const canPick = Boolean(onSelectRewardModel);
  return (
    <View style={styles.wrap} accessible={canPick} importantForAccessibility={canPick ? 'yes' : 'no-hide-descendants'}>
      {constants.rewardModels.map((model) => {
        const on = model.key === activeRewardModel;
        return (
          <Pressable
            key={model.key}
            disabled={!canPick}
            onPress={() => onSelectRewardModel?.(model.key)}
            accessibilityRole={canPick ? 'radio' : undefined}
            accessibilityState={canPick ? { selected: on } : undefined}
            accessibilityLabel={canPick ? `${model.label}${on ? ', current' : ''}` : undefined}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: on ? palette.warn : palette.deep,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text
              style={[
                styles.label,
                { color: on ? palette.surface : '#C9D6E8', fontWeight: on ? '700' : '600' },
              ]}>
              {model.label}
            </Text>
          </Pressable>
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
