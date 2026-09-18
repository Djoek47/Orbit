import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { HR } from '@/lib/rules/house-rules-palette';

/** Quiet placeholder when rule.visual === 'none'. */
export function NoneCard(_props: VisualWidgetProps) {
  return null;
}

/** XP value ramp from constants.xpValues. */
export function XpRamp({ constants, palette, voice }: VisualWidgetProps) {
  const values = constants.xpValues;
  const max = Math.max(...values, 1);
  const barMax = voice === 'sidekick' ? 78 : 64;

  return (
    <View style={[styles.row, { height: barMax }]} accessible={false} importantForAccessibility="no-hide-descendants">
      {values.map((xp, i) => {
        const height = Math.round(20 + (80 * xp) / max);
        const fill = voice === 'sidekick' ? HR.skStairs[i] ?? palette.success : palette.warn;
        return (
          <View key={xp} style={[styles.col, { height: barMax }]}>
            <View style={[styles.barWrap, { height: barMax }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${height}%`,
                    backgroundColor: fill,
                    borderTopLeftRadius: voice === 'sidekick' ? 7 : 5,
                    borderTopRightRadius: voice === 'sidekick' ? 7 : 5,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.label,
                { color: voice === 'sidekick' ? palette.ink : '#C9D6E8', top: -17 },
              ]}>
              {xp}
            </Text>
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
    marginTop: 16,
    marginBottom: 10,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barWrap: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  label: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  bar: {
    alignSelf: 'stretch',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
