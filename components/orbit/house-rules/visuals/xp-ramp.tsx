import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { HR } from '@/lib/rules/house-rules-palette';

/** Quiet placeholder when rule.visual === 'none'. */
export function NoneCard(_props: VisualWidgetProps) {
  return null;
}

/** XP value ramp from constants.xpValues. Adult amber bars; Sidekick mint→punch stairs. */
export function XpRamp({ constants, palette, voice }: VisualWidgetProps) {
  const values = constants.xpValues;
  const max = Math.max(...values, 1);
  const barMax = voice === 'kid' ? 78 : 64;

  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {values.map((xp, i) => {
        const height = Math.max(barMax * 0.24, (xp / max) * barMax);
        const fill =
          voice === 'kid' ? HR.kidStairs[i] ?? palette.success : palette.warn;
        return (
          <View key={xp} style={[styles.col, { height: barMax }]}>
            <Text
              style={[
                styles.label,
                { color: voice === 'kid' ? palette.ink : palette.inkSoft },
              ]}>
              {xp}
            </Text>
            <View
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: fill,
                  borderTopLeftRadius: 5,
                  borderTopRightRadius: 5,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  label: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    marginBottom: 4,
  },
  bar: {
    alignSelf: 'stretch',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
