import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { typography } from '@/constants/orbit-theme';

function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

/**
 * Day timeline with labeled segments — Full / Late Credit / Expired.
 * Labels are text (not color-only).
 */
export function DayTimeline({ constants, palette, voice }: VisualWidgetProps) {
  const fullUntil = formatTime(constants.deadlines.daily);
  const expiredAt = formatTime(constants.expiryTime);
  const segments =
    voice === 'kid'
      ? [
          { key: 'full', label: 'Full points', until: fullUntil, color: palette.success },
          { key: 'late', label: 'Still some', until: expiredAt, color: palette.warn },
          { key: 'gone', label: 'Gone', until: '', color: palette.danger },
        ]
      : [
          { key: 'full', label: 'Full', until: fullUntil, color: palette.success },
          { key: 'late', label: 'Late Credit', until: expiredAt, color: palette.warn },
          { key: 'gone', label: 'Expired', until: '', color: palette.danger },
        ];

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.bar}>
        {segments.map((seg) => (
          <View key={seg.key} style={[styles.seg, { backgroundColor: `${seg.color}55` }]} />
        ))}
      </View>
      <View style={styles.labels}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.labelCol}>
            <Text style={[typography.caption2, { color: seg.color, fontWeight: '700' }]}>
              {seg.label}
            </Text>
            {seg.until ? (
              <Text style={[typography.caption2, { color: palette.muted }]}>until {seg.until}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 6 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2 },
  seg: { flex: 1 },
  labels: { flexDirection: 'row', gap: 4 },
  labelCol: { flex: 1, gap: 2 },
});
