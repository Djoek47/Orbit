/**
 * "THAT AFTERNOON" — the day's other events as small bars, the new one in the accent,
 * and one line saying what it clashes with. Layout comes from `lib/calendar/day-strip`.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { STAGE, stageBorder, stageDangerText, stageFaint, stageMuted } from '@/constants/iui-stage';
import { space, typography } from '@/constants/orbit-theme';
import type { DayStripBar, DayStripLayout } from '@/lib/calendar/day-strip';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  layout: DayStripLayout;
  /** Fill colour for the new event's bar. */
  fill: string;
};

const TRACK_HEIGHT = 44;
const HEIGHT: Record<DayStripBar['kind'], number> = { new: 44, clash: 32, next: 30, other: 20 };

export function DayStrip({ layout, fill }: Props) {
  const { isDark } = useOrbitColors();
  const neutral = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,28,42,0.10)';
  const colour = (kind: DayStripBar['kind']) =>
    kind === 'new'
      ? `${fill}B3`
      : kind === 'clash'
        ? `${STAGE.semantic.danger}8C`
        : kind === 'next'
          ? `${STAGE.domain.rewards}8C`
          : neutral;
  const clashes = layout.bars.some((bar) => bar.kind === 'clash');
  const hours: number[] = [];
  for (let m = Math.ceil(layout.from / 60) * 60; m <= layout.to; m += 60) hours.push(m);
  const span = layout.to - layout.from;

  return (
    <View
      style={[styles.wrap, { borderTopColor: stageBorder(isDark) }]}
      accessibilityLabel={`${layout.label.toLowerCase()}: ${layout.sentence}`}>
      <Text style={[typography.caption2, styles.kicker, { color: stageFaint(isDark) }]}>{layout.label}</Text>
      <View style={styles.track}>
        {hours.map((m) => (
          <View
            key={m}
            style={[
              styles.tick,
              { left: `${((m - layout.from) / span) * 100}%`, backgroundColor: stageBorder(isDark) },
            ]}
          />
        ))}
        <View style={[styles.baseline, { backgroundColor: neutral }]} />
        {layout.bars.map((bar) => (
          <View
            key={bar.id}
            style={[
              styles.bar,
              {
                left: `${bar.left * 100}%`,
                width: `${bar.width * 100}%`,
                height: HEIGHT[bar.kind],
                backgroundColor: colour(bar.kind),
                zIndex: bar.kind === 'new' ? 2 : 1,
              },
            ]}
          />
        ))}
      </View>
      <Text
        style={[
          typography.caption1,
          { color: clashes ? stageDangerText(isDark) : stageMuted(isDark) },
        ]}>
        {layout.sentence}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  kicker: { letterSpacing: 1.2 },
  track: { height: TRACK_HEIGHT, position: 'relative' },
  tick: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1 },
  bar: {
    position: 'absolute',
    bottom: 0,
    borderRadius: 6,
    borderCurve: 'continuous',
    minWidth: 6,
  },
});
