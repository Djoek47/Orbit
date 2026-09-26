/**
 * The "Full breakdown" card on the Completed tab — sits where the XP banner is on Active.
 *
 *   ┌ THIS WEEK ───────────────────────── Full breakdown › ┐
 *   │  12 done · 3h 40m saved            ▂ ▅ ▃ ▇ ▁ ▄ █     │
 *   └──────────────────────────────────── M T W T F S S ───┘
 *
 * Tapping opens /completed-breakdown (D · W · M · 6M · Y, Health-style).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { radius, space, typography } from '@/constants/orbit-theme';
import { completionEvents, computeBreakdown, formatMinutes } from '@/lib/tasks/completion-stats';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

type Props = {
  tasks: HouseholdTask[];
  members: HouseholdMember[];
  accent: string;
};

const STRIP_HEIGHT = 34;

export function CompletedBreakdownCard({ tasks, members, accent }: Props) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const week = useMemo(() => computeBreakdown(completionEvents(tasks, members), 'W'), [tasks, members]);
  const peak = Math.max(1, ...week.buckets.map((b) => b.tasks));
  const track = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.08)';
  const { tasks: done, minutesSaved } = week.totals;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`This week: ${done} tasks done, ${formatMinutes(minutesSaved)} saved. Open full breakdown`}
      onPress={() => router.push('/completed-breakdown')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: glass(0.06), borderColor: glassBorder(0.1), opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.left}>
        <View style={styles.eyebrowRow}>
          <Moji name="trophy" size={16} />
          <Text style={[typography.eyebrow, { color: c.textSubtle }]}>This week</Text>
        </View>
        <Text style={[styles.big, { color: c.text }]}>
          {done}
          <Text style={[styles.unit, { color: c.textMuted }]}> done</Text>
        </Text>
        <Text style={[typography.footnote, { color: minutesSaved ? c.success : c.textMuted, fontWeight: '600' }]}>
          {minutesSaved ? `${formatMinutes(minutesSaved)} saved by Sidekicks` : 'Time saved shows as Sidekicks finish'}
        </Text>
        <View style={styles.linkRow}>
          <Text style={[typography.footnote, { color: accent, fontWeight: '700' }]}>Full breakdown</Text>
          <MaterialIcons name="chevron-right" size={16} color={accent} />
        </View>
      </View>

      <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {week.buckets.map((bucket, index) => {
          const h = bucket.tasks ? Math.max(4, Math.round((bucket.tasks / peak) * STRIP_HEIGHT)) : 3;
          const isToday = index === week.buckets.length - 1;
          return (
            <View key={index} style={styles.col}>
              <View style={[styles.slot, { height: STRIP_HEIGHT }]}>
                <View
                  style={[
                    styles.bar,
                    { height: h, backgroundColor: bucket.tasks ? (isToday ? accent : `${accent}AA`) : track },
                  ]}
                />
              </View>
              <Text style={[styles.day, { color: isToday ? c.text : c.textSubtle }]}>
                {bucket.label.slice(0, 1)}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  left: { flex: 1, gap: 2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  big: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  strip: { flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  col: { alignItems: 'center', gap: 4 },
  slot: { justifyContent: 'flex-end' },
  bar: { width: 9, borderRadius: 3 },
  day: { fontSize: 10, fontWeight: '700' },
});
