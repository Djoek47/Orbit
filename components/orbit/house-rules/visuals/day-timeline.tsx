import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { VOCAB } from '@/constants/vocabulary';
import { HR } from '@/lib/rules/house-rules-palette';
import { formatHouseRulesTime } from '@/lib/rules/interpolate';

/**
 * Adult: rail with three labeled markers (color is never the only signal).
 * Sidekick: two time callouts from deadlines.daily + expiryTime.
 */
export function DayTimeline({ constants, palette, voice }: VisualWidgetProps) {
  const daily = formatHouseRulesTime(constants.deadlines.daily);
  const expiry = formatHouseRulesTime(constants.expiryTime);

  if (voice === 'kid') {
    const hour = (label: string) => label.replace(/\s?(AM|PM)$/i, '');
    return (
      <View style={styles.kidWrap} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.bell, { backgroundColor: HR.glanceSeg }]}>
          <Text style={[styles.bellTime, { color: palette.warn }]}>{hour(daily)}</Text>
          <Text style={[styles.bellCap, { color: palette.inkSoft }]}>{daily}</Text>
        </View>
        <View style={[styles.bell, { backgroundColor: HR.glanceSeg, marginTop: 8 }]}>
          <Text style={[styles.bellTime, { color: palette.warn }]}>{hour(expiry)}</Text>
          <Text style={[styles.bellCap, { color: palette.inkSoft }]}>{expiry}</Text>
        </View>
      </View>
    );
  }

  const marks: { left: `${number}%`; line1: string; line2: string }[] = [
    { left: '8%', line1: daily, line2: '' },
    { left: '52%', line1: VOCAB.lateCredit, line2: daily },
    { left: '92%', line1: VOCAB.expired, line2: expiry },
  ];

  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.timeline}>
        <View style={styles.rail}>
          <View style={[styles.railSeg, { flex: 52, backgroundColor: palette.success }]} />
          <View style={[styles.railSeg, { flex: 36, backgroundColor: palette.warn }]} />
          <View style={[styles.railSeg, { flex: 12, backgroundColor: palette.danger }]} />
        </View>
        {marks.map((mark) => (
          <View key={mark.left} style={[styles.mk, { left: mark.left }]}>
            <View style={[styles.dot, { borderColor: palette.card }]} />
            <Text style={[styles.mkText, { color: palette.inkSoft }]}>
              {mark.line1}
              {mark.line2 ? `\n${mark.line2}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 15, marginBottom: 6 },
  timeline: { height: 64, position: 'relative' },
  rail: {
    borderRadius: 99,
    flexDirection: 'row',
    height: 5,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 14,
  },
  railSeg: { height: 5 },
  mk: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -38 }],
    width: 76,
    alignItems: 'center',
  },
  dot: {
    backgroundColor: '#fff',
    borderRadius: 99,
    borderWidth: 3,
    height: 11,
    marginTop: 11,
    width: 11,
  },
  mkText: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  kidWrap: { marginTop: 13 },
  bell: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  bellTime: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  bellCap: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
