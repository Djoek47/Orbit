import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

/** Quiet placeholder when rule.visual === 'none'. */
export function NoneCard(_props: VisualWidgetProps) {
  return null;
}

/** XP value ramp from constants.xpValues. */
export function XpRamp({ constants, palette, voice }: VisualWidgetProps) {
  const values = constants.xpValues;
  return (
    <View style={styles.row} accessibilityRole="summary">
      {values.map((xp, i) => (
        <View
          key={xp}
          style={[
            styles.step,
            {
              backgroundColor: palette.pillBg,
              borderColor: palette.cardBorder,
              height: 28 + i * 6,
            },
          ]}>
          <Text style={[typography.caption2, { color: palette.pillText, fontWeight: '700' }]}>
            {xp}
          </Text>
          {voice === 'kid' && i === values.length - 1 ? (
            <Text style={[typography.caption2, { color: palette.muted }]}>max</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 10,
  },
  step: {
    flex: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    minHeight: 28,
  },
});
