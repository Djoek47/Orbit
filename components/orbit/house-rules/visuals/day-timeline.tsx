import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { VOCAB } from '@/constants/vocabulary';
import { formatHouseRulesTime, resolvedDailyDeadline } from '@/lib/rules/interpolate';

function mins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function pct(hhmm: string, start: number, end: number): number {
  return Math.max(4, Math.min(94, ((mins(hhmm) - start) / Math.max(1, end - start)) * 100));
}

/**
 * Admin: rail with three labeled markers, positioned by time (noon → expiry).
 * Sidekick: two bells — large time once, caption without repeating the clock.
 */
export function DayTimeline({ constants, palette, voice, dailyDeadline, use24h }: VisualWidgetProps) {
  const deadlineHm = resolvedDailyDeadline(constants, { dailyDeadline });
  const daily = formatHouseRulesTime(deadlineHm, use24h);
  const expiry = formatHouseRulesTime(constants.expiryTime, use24h);
  const nudge = constants.nudgeMinutesBefore;

  if (voice === 'sidekick') {
    return (
      <View style={styles.kidWrap} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.bell, { backgroundColor: palette.deep }]}>
          <Text style={[styles.bellTime, { color: palette.warn }]}>{daily}</Text>
          <Text style={[styles.bellCap, { color: palette.inkSoft }]}>
            The bell. Poppins nudges you {nudge} minutes before.
          </Text>
        </View>
        <View style={[styles.bell, { backgroundColor: palette.deep, marginTop: 12 }]}>
          <Text style={[styles.bellTime, { color: palette.warn }]}>{expiry}</Text>
          <Text style={[styles.bellCap, { color: palette.inkSoft }]}>
            The day closes. Anything left is gone.
          </Text>
        </View>
      </View>
    );
  }

  const start = mins('12:00');
  const end = mins(constants.expiryTime);
  const d = pct(deadlineHm, start, end);
  const marks: { left: number; line1: string; line2: string }[] = [
    { left: 6, line1: 'Full XP', line2: `until ${daily}` },
    { left: d, line1: VOCAB.lateCredit, line2: daily },
    { left: 94, line1: VOCAB.expired, line2: expiry },
  ];

  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.timeline}>
        <View
          style={[
            styles.rail,
            {
              backgroundColor: palette.danger,
            },
          ]}>
          <View style={[styles.railFill, { width: `${d}%`, backgroundColor: palette.success }]} />
          <View
            style={[
              styles.railLate,
              {
                left: `${d}%`,
                width: `${Math.max(0, 97 - d)}%`,
                backgroundColor: palette.warn,
              },
            ]}
          />
        </View>
        {marks.map((mark) => (
          <View key={`${mark.line1}-${mark.left}`} style={[styles.mk, { left: `${mark.left}%` }]}>
            <View style={[styles.dot, { borderColor: palette.card }]} />
            <Text style={[styles.mkText, { color: palette.inkSoft }]}>
              {mark.line1}
              {'\n'}
              {mark.line2}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, marginBottom: 8 },
  timeline: { height: 72, position: 'relative' },
  rail: {
    borderRadius: 99,
    height: 5,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 14,
  },
  railFill: { height: 5, position: 'absolute', left: 0, top: 0 },
  railLate: { height: 5, position: 'absolute', top: 0 },
  mk: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -40 }],
    width: 80,
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
  kidWrap: { marginTop: 12 },
  bell: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  bellTime: {
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  bellCap: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
