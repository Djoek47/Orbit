import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';

export function GateSteps({ palette, voice }: VisualWidgetProps) {
  if (voice === 'sidekick') {
    return (
      <View style={styles.sk} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.skRow, { backgroundColor: palette.deep }]}>
          <Text style={[styles.skHead, { color: palette.warn }]}>If your day is done</Text>
          <Text style={[styles.skBody, { color: palette.inkSoft }]}>The prize goes through on its own.</Text>
        </View>
        <View style={[styles.skRow, { backgroundColor: palette.deep }]}>
          <Text style={[styles.skHead, { color: palette.warn }]}>If it isn't</Text>
          <Text style={[styles.skBody, { color: palette.inkSoft }]}>
            You'll be asked to finish today's tasks and homework first.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.admin} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.step, { backgroundColor: palette.deep }]}>
        <Text style={[styles.stepLab, { color: palette.warn }]}>Step 1</Text>
        <Text style={[styles.stepBody, { color: palette.inkSoft }]}>
          The day's tasks and homework all complete
        </Text>
      </View>
      <Text style={[styles.arrow, { color: '#5C6E8A' }]}>→</Text>
      <View style={[styles.step, { backgroundColor: palette.deep }]}>
        <Text style={[styles.stepLab, { color: palette.warn }]}>Step 2</Text>
        <Text style={[styles.stepBody, { color: palette.inkSoft }]}>
          Instant grants; approval-required comes to you
        </Text>
      </View>
    </View>
  );
}

export function FrequencyGrid({ constants, palette, voice }: VisualWidgetProps) {
  const primary = constants.primaryFrequencies;
  const rest = Math.max(0, constants.frequencyCount - primary.length);
  const chips = primary.map((f) => f.charAt(0).toUpperCase() + f.slice(1));

  return (
    <View style={styles.freq} accessible={false} importantForAccessibility="no-hide-descendants">
      {chips.map((label) => (
        <View key={label} style={[styles.chip, { backgroundColor: palette.deep }]}>
          <Text style={[styles.chipText, { color: voice === 'sidekick' ? palette.pillText : '#C9D6E8' }]}>
            {label}
          </Text>
        </View>
      ))}
      {voice === 'admin' ? (
        <View style={[styles.chip, styles.more, { borderColor: '#3C5075' }]}>
          <Text style={[styles.chipText, { color: palette.muted, fontWeight: '600' }]}>+{rest} behind More</Text>
        </View>
      ) : null}
    </View>
  );
}

export function TrophyScale({ constants, palette, voice }: VisualWidgetProps) {
  const { name, xp } = constants.topTrophy;
  const figure = xp.toLocaleString();
  return (
    <View style={styles.big} accessible={false} importantForAccessibility="no-hide-descendants">
      <Text style={[styles.bigNum, { color: palette.warn, fontSize: voice === 'sidekick' ? 30 : 27 }]}>
        {figure}
      </Text>
      <Text style={[styles.bigCap, { color: palette.muted }]}>
        {voice === 'sidekick' ? `points for\n${name}` : `lifetime XP\n${name}`}
      </Text>
    </View>
  );
}

export function ZeroXpShare({ constants, palette, voice }: VisualWidgetProps) {
  if (voice === 'sidekick') return null;
  const s = constants.library.streakOnlyTasks;
  const t = constants.library.totalTasks;
  const pct = t > 0 ? (s / t) * 100 : 0;
  return (
    <View style={styles.share} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.bar, { backgroundColor: palette.deep }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: palette.warn }]} />
      </View>
      <Text style={[styles.shareKey, { color: palette.muted }]}>
        {s} of {t} library tasks score zero XP
      </Text>
    </View>
  );
}

export function InviteFacts({ constants, palette, voice }: VisualWidgetProps) {
  const i = constants.invites;
  if (voice === 'sidekick') {
    return (
      <View style={styles.freq} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.chip, { backgroundColor: palette.cardBorder }]}>
          <Text style={[styles.chipText, { color: palette.pillText }]}>{i.expiryDays} days</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: palette.cardBorder }]}>
          <Text style={[styles.chipText, { color: palette.pillText }]}>1 use</Text>
        </View>
      </View>
    );
  }
  const tiles = [
    { key: 'd', value: String(i.expiryDays), cap: 'days\nvalid' },
    { key: 'u', value: '1', cap: 'use\nonly' },
    { key: 'a', value: String(i.activePerMember), cap: 'active\nper person' },
  ];
  return (
    <View style={styles.tiles} accessible={false} importantForAccessibility="no-hide-descendants">
      {tiles.map((tile) => (
        <View key={tile.key} style={[styles.tile, { backgroundColor: palette.deep }]}>
          <Text style={[styles.tileNum, { color: palette.warn }]}>{tile.value}</Text>
          <Text style={[styles.tileCap, { color: palette.muted }]}>{tile.cap}</Text>
        </View>
      ))}
    </View>
  );
}

export function ExpiryWindow({ constants, palette, voice }: VisualWidgetProps) {
  const n = constants.expiredPurgeDays;
  return (
    <View style={styles.big} accessible={false} importantForAccessibility="no-hide-descendants">
      <Text style={[styles.bigNum, { color: palette.warn, fontSize: voice === 'sidekick' ? 30 : 27 }]}>{n}</Text>
      <Text style={[styles.bigCap, { color: palette.muted }]}>
        {voice === 'sidekick' ? 'days in the\nExpired tab' : 'days visible\nbefore clearing'}
      </Text>
    </View>
  );
}

export function WeekTrend({ palette, voice }: VisualWidgetProps) {
  const bars = [
    { h: 46, cap: '3 wks', now: false },
    { h: 62, cap: '2 wks', now: false },
    { h: 55, cap: 'last', now: false },
    { h: 100, cap: voice === 'sidekick' ? 'beat it' : 'this', now: true },
  ];
  const max = voice === 'sidekick' ? 84 : 72;
  return (
    <View
      style={[styles.trend, { height: max }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {bars.map((bar) => (
        <View key={bar.cap} style={[styles.trendCol, { height: max }]}>
          {voice === 'admin' || bar.now ? (
            <Text style={[styles.trendCap, { color: bar.now ? palette.warn : palette.muted }]}>{bar.cap}</Text>
          ) : null}
          <View
            style={[
              styles.trendBar,
              {
                height: `${bar.h}%`,
                backgroundColor: bar.now ? palette.warn : voice === 'sidekick' ? palette.cardBorder : '#2A3A57',
                borderTopLeftRadius: voice === 'sidekick' ? 8 : 6,
                borderTopRightRadius: voice === 'sidekick' ? 8 : 6,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  admin: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 14,
  },
  step: { borderRadius: 11, flex: 1, paddingHorizontal: 11, paddingVertical: 10 },
  stepLab: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, textTransform: 'uppercase' },
  stepBody: { fontSize: 12, lineHeight: 16 },
  arrow: { alignSelf: 'center', fontSize: 15 },
  sk: { gap: 8, marginBottom: 10, marginTop: 14 },
  skRow: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  skHead: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' },
  skBody: { fontSize: 12.5, lineHeight: 18 },
  freq: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, marginTop: 14 },
  chip: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  more: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed' },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  big: { alignItems: 'baseline', flexDirection: 'row', gap: 9, marginBottom: 10, marginTop: 14 },
  bigNum: { fontVariant: ['tabular-nums'], fontWeight: '800', letterSpacing: -0.4 },
  bigCap: { fontSize: 12.5, lineHeight: 17 },
  share: { marginBottom: 10, marginTop: 14 },
  bar: { borderRadius: 99, height: 11, overflow: 'hidden' },
  barFill: { height: '100%' },
  shareKey: { fontSize: 11.5, fontVariant: ['tabular-nums'], marginTop: 8 },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 14 },
  tile: { alignItems: 'center', borderRadius: 11, flex: 1, paddingHorizontal: 9, paddingVertical: 10 },
  tileNum: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '800' },
  tileCap: { fontSize: 10.5, lineHeight: 14, marginTop: 3, textAlign: 'center' },
  trend: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 18 },
  trendCol: { flex: 1, justifyContent: 'flex-end', position: 'relative' },
  trendCap: { fontSize: 10.5, fontWeight: '700', position: 'absolute', top: -17, left: 0, right: 0, textAlign: 'center' },
  trendBar: { alignSelf: 'stretch', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
});
