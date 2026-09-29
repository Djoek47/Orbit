/**
 * Completed — full breakdown. A Health-style chart of finished tasks over D / W / M / 6M / Y,
 * stacked by kind of chore, with the time Sidekicks saved the house.
 *
 *   [ D | W | M | 6M | Y ]
 *   [ Tasks · Time saved ]           metric
 *   AVERAGE                           (or the tapped bar's date)
 *   4.3 tasks a day                   big number
 *   Sep 20 – 26, 2026
 *   ▁▃█▅▂▇▁   stacked bars, gridlines on the right, tap a bar to read it
 *   Tasks 30 · Time saved 3h 20m · By Sidekicks 18
 *   Kitchen ▮▮▮▮ 12 · 1h 40m …       categories
 *
 * Numbers: lib/tasks/completion-stats (tested). History: the task repository, paged, so a
 * year of daily chores isn't cut at Supabase's 1,000-row default.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect } from 'react-native-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { space, typography } from '@/constants/orbit-theme';
import {
  BREAKDOWN_RANGES,
  completionEvents,
  computeBreakdown,
  FAMILY_META,
  FAMILY_ORDER,
  formatMinutes,
  niceMax,
  type BreakdownRange,
  type Bucket,
} from '@/lib/tasks/completion-stats';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { taskRepository } from '@/repositories/task-repository';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';

type Metric = 'tasks' | 'time';

const RANGE_LABEL: Record<BreakdownRange, string> = { D: 'D', W: 'W', M: 'M', '6M': '6M', Y: 'Y' };
/** Days of history each range needs (fetch from the earliest). */
const CHART_HEIGHT = 220;
const X_LABEL_W = 44;

export default function CompletedBreakdownScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const { household, currentMember, permissions } = useOrbit();
  const params = useLocalSearchParams<{ range?: string }>();
  const initial = BREAKDOWN_RANGES.includes(params.range as BreakdownRange) ? (params.range as BreakdownRange) : 'W';
  const [range, setRange] = useState<BreakdownRange>(initial);
  const [metric, setMetric] = useState<Metric>('tasks');
  const [selected, setSelected] = useState<number | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [history, setHistory] = useState<HouseholdTask[] | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdult = permissions.canManageHousehold;
  const now = useMemo(() => new Date(), []);

  // History for the widest range, once — ranges then switch instantly.
  useEffect(() => {
    let cancelled = false;
    const since = computeBreakdown([], 'Y', now).since.toISOString();
    void (async () => {
      try {
        const { usesProfileCodeAuth } = await import('@/lib/sidekick/task-action');
        // A Sidekick signed in by profile code reads through sync, not the table: use what's loaded.
        if (await usesProfileCodeAuth()) return;
        const rows = await taskRepository.listCompletedSince(household.id, since);
        if (!cancelled) setHistory(rows);
      } catch (error) {
        console.warn('completed-breakdown history', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [household.id, now]);

  // Fetched history + anything finished in this session that the fetch hasn't seen.
  const tasks = useMemo(() => {
    const byId = new Map<string, HouseholdTask>();
    for (const task of history ?? []) byId.set(task.id, task);
    for (const task of household.tasks) byId.set(task.id, task);
    return [...byId.values()];
  }, [history, household.tasks]);

  const events = useMemo(() => {
    const all = completionEvents(tasks, household.members);
    // A Sidekick sees their own; an adult sees everyone, or one person.
    const scope = isAdult ? who : currentMember?.name ?? null;
    return scope ? all.filter((event) => event.by === scope) : all;
  }, [tasks, household.members, isAdult, who, currentMember?.name]);

  const breakdown = useMemo(() => computeBreakdown(events, range, now), [events, range, now]);

  const valueOf = (bucket: Bucket) => (metric === 'tasks' ? bucket.tasks : bucket.minutesSaved);
  const peak = Math.max(0, ...breakdown.buckets.map(valueOf));
  const top = metric === 'tasks' ? niceMax(peak) : niceMax(Math.max(peak, 30));

  const sel = selected != null ? breakdown.buckets[selected] : null;
  const headLabel = sel ? sel.title.toUpperCase() : breakdown.headline.kind === 'average' ? 'AVERAGE' : 'TOTAL';
  const headNumber = sel
    ? metric === 'tasks'
      ? String(sel.tasks)
      : formatMinutes(sel.minutesSaved)
    : metric === 'tasks'
      ? breakdown.headline.kind === 'average'
        ? breakdown.headline.tasks >= 10
          ? String(Math.round(breakdown.headline.tasks))
          : breakdown.headline.tasks.toFixed(1)
        : String(breakdown.headline.tasks)
      : formatMinutes(breakdown.headline.minutesSaved);
  const headUnit =
    metric === 'tasks'
      ? `task${(sel ? sel.tasks : breakdown.headline.tasks) === 1 ? '' : 's'}${!sel && breakdown.headline.kind === 'average' ? ' a day' : ''}`
      : `saved${!sel && breakdown.headline.kind === 'average' ? ' a day' : ''}`;

  const people = household.members.filter((m) => m.status !== 'inactive');
  const barColor = metric === 'tasks' ? undefined : c.success;

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <MaterialIcons name="chevron-left" size={28} color={c.text} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text }]}>Completed</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* D W M 6M Y */}
        <View style={[styles.rangeBar, { backgroundColor: glass(0.08) }]}>
          {BREAKDOWN_RANGES.map((r) => {
            const on = r === range;
            return (
              <Pressable
                key={r}
                onPress={() => {
                  setSelected(null);
                  setRange(r);
                }}
                style={[styles.rangeBtn, on && { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,28,42,0.12)' }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={{ D: 'Day', W: 'Week', M: 'Month', '6M': 'Six months', Y: 'Year' }[r]}>
                <Text style={[styles.rangeText, { color: on ? c.text : c.textMuted }]}>{RANGE_LABEL[r]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tasks · Time saved */}
        <View style={styles.metricRow}>
          {(['tasks', 'time'] as const).map((m) => {
            const on = m === metric;
            return (
              <Pressable
                key={m}
                onPress={() => setMetric(m)}
                style={[
                  styles.metricChip,
                  {
                    backgroundColor: on ? `${m === 'tasks' ? c.primary : c.success}22` : glass(0.05),
                    borderColor: on ? `${m === 'tasks' ? c.primary : c.success}66` : glassBorder(0.1),
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}>
                <MaterialIcons
                  name={m === 'tasks' ? 'task-alt' : 'schedule'}
                  size={15}
                  color={on ? (m === 'tasks' ? c.primary : c.success) : c.textMuted}
                />
                <Text style={[typography.footnote, { color: on ? c.text : c.textMuted, fontWeight: '700' }]}>
                  {m === 'tasks' ? 'Tasks' : 'Time saved'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Who (adults) */}
        {isAdult ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.whoRow}>
            <WhoChip label="Everyone" on={who == null} onPress={() => {
              setSelected(null);
              setWho(null);
            }} c={c} glass={glass} glassBorder={glassBorder} />
            {people.map((m) => (
              <WhoChip
                key={m.id}
                label={m.name.split(' ')[0]!}
                on={who === m.name}
                onPress={() => {
                  setSelected(null);
                  setWho(who === m.name ? null : m.name);
                }}
                c={c}
                glass={glass}
                glassBorder={glassBorder}
                icon={<MemberGlyph member={m} size={13} />}
              />
            ))}
          </ScrollView>
        ) : null}

        {/* Headline */}
        <View style={styles.headline}>
          <Text style={[styles.headLabel, { color: c.textMuted }]}>{headLabel}</Text>
          <View style={styles.headNumberRow}>
            <Text style={[styles.headNumber, { color: c.text }]}>{headNumber}</Text>
            <Text style={[styles.headUnit, { color: c.textMuted }]}>{headUnit}</Text>
          </View>
          <Text style={[styles.headSpan, { color: c.textMuted }]}>{breakdown.span}</Text>
        </View>

        {/* Chart */}
        <BarChart
          buckets={breakdown.buckets}
          metric={metric}
          top={top}
          selected={selected}
          onSelect={(i) => setSelected(selected === i ? null : i)}
          grid={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,28,42,0.12)'}
          text={c.textMuted}
          single={barColor}
        />
        {loading && !history ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={c.textMuted} />
            <Text style={[typography.caption1, { color: c.textMuted }]}>Loading history…</Text>
          </View>
        ) : null}

        {/* Totals for the range */}
        <View style={styles.kpis}>
          <Kpi label="Tasks completed" value={String(breakdown.totals.tasks)} color={c.primary} c={c} glass={glass} glassBorder={glassBorder} />
          <Kpi label="Time saved" value={formatMinutes(breakdown.totals.minutesSaved)} color={c.success} c={c} glass={glass} glassBorder={glassBorder} />
          <Kpi label="By Sidekicks" value={String(breakdown.totals.bySidekicks)} color={c.planPurple} c={c} glass={glass} glassBorder={glassBorder} />
        </View>

        {/* Categories */}
        <GlassCard style={{ gap: 12 }}>
          <Text style={[typography.eyebrow, { color: c.textSubtle }]}>
            {sel ? `By kind · ${sel.title}` : 'By kind of task'}
          </Text>
          {(sel
            ? FAMILY_ORDER.filter((f) => sel.byFamily[f]).map((f) => ({ family: f, ...sel.byFamily[f]! }))
            : breakdown.byFamily
          ).map((row) => {
            const meta = FAMILY_META[row.family];
            const total = sel ? sel.tasks : breakdown.totals.tasks;
            const pct = total ? row.tasks / total : 0;
            return (
              <View key={row.family} style={styles.familyRow}>
                <Moji name={meta.moji as MojiName} size={24} />
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={styles.familyTop}>
                    <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>{meta.label}</Text>
                    <Text style={[typography.footnote, { color: c.textMuted }]}>
                      {row.tasks} · {formatMinutes(row.minutesSaved)} saved
                    </Text>
                  </View>
                  <View style={[styles.familyBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.08)' }]}>
                    <View style={[styles.familyFill, { width: `${Math.max(3, Math.round(pct * 100))}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
              </View>
            );
          })}
          {breakdown.totals.tasks === 0 ? (
            <Text style={[typography.footnote, { color: c.textMuted }]}>Nothing finished in this range yet.</Text>
          ) : null}
        </GlassCard>

        <Text style={[styles.footnote, { color: c.textSubtle }]}>
          Time saved counts chores finished by Sidekicks, at a typical time for each kind of chore
          (unloading the dishwasher ≈ 10 min, mowing ≈ 45 min). Homework and a child&apos;s own
          routine aren&apos;t counted as time saved.
        </Text>
      </ScrollView>
    </View>
  );
}

function BarChart({
  buckets,
  metric,
  top,
  selected,
  onSelect,
  grid,
  text,
  single,
}: {
  buckets: Bucket[];
  metric: Metric;
  top: number;
  selected: number | null;
  onSelect: (index: number) => void;
  grid: string;
  text: string;
  single?: string;
}) {
  const [width, setWidth] = useState(0);
  const axisW = 44;
  const plotW = Math.max(0, width - axisW);
  const slot = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.max(2, Math.min(28, slot * 0.62));
  const h = CHART_HEIGHT;
  const ticks = [0, top / 2, top];
  const label = (v: number) =>
    metric === 'tasks' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : formatMinutes(v);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ marginTop: 8 }}>
      <View style={{ height: h }}>
        {width > 0 ? (
          <Svg width={width} height={h}>
            {ticks.map((t) => {
              const y = h - (t / top) * (h - 8) - 0.5;
              return <Line key={t} x1={0} x2={plotW} y1={y} y2={y} stroke={grid} strokeWidth={1} strokeDasharray={t === 0 ? undefined : '3 4'} />;
            })}
            {buckets.map((bucket, i) => {
              const x = i * slot + (slot - barW) / 2;
              let y = h;
              const dim = selected != null && selected !== i;
              const parts = single
                ? [{ key: 'all', v: metric === 'tasks' ? bucket.tasks : bucket.minutesSaved, color: single }]
                : FAMILY_ORDER.filter((f) => bucket.byFamily[f]).map((f) => ({
                    key: f,
                    v: metric === 'tasks' ? bucket.byFamily[f]!.tasks : bucket.byFamily[f]!.minutesSaved,
                    color: FAMILY_META[f].color,
                  }));
              return parts.map((part) => {
                const ph = (part.v / top) * (h - 8);
                y -= ph;
                return ph > 0 ? (
                  <Rect key={`${i}-${part.key}`} x={x} y={y} width={barW} height={ph} rx={Math.min(4, barW / 3)} fill={part.color} opacity={dim ? 0.35 : 1} />
                ) : null;
              });
            })}
          </Svg>
        ) : null}
        {/* Axis values, right side — like Health */}
        {ticks.map((t) => (
          <Text
            key={`t${t}`}
            style={[
              styles.tick,
              { color: text, top: h - (t / top) * (h - 8) - 8, left: plotW + 6 },
            ]}>
            {label(t)}
          </Text>
        ))}
        {/* Tap targets */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', width: plotW }]}>
          {buckets.map((bucket, i) => (
            <Pressable
              key={i}
              style={{ flex: 1 }}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityLabel={`${bucket.title}: ${bucket.tasks} tasks, ${formatMinutes(bucket.minutesSaved)} saved`}
            />
          ))}
        </View>
      </View>
      {/* Labels sit under their bar but may run wider than it ("12 AM" over a 24-bar day). */}
      <View style={[styles.xLabels, { width: plotW }]}>
        {buckets.map((bucket, i) =>
          bucket.label ? (
            <Text
              key={i}
              numberOfLines={1}
              style={[
                styles.xLabel,
                {
                  color: text,
                  left: Math.min(Math.max(0, i * slot + slot / 2 - X_LABEL_W / 2), Math.max(0, plotW - X_LABEL_W)),
                },
              ]}>
              {bucket.label}
            </Text>
          ) : null
        )}
      </View>
    </View>
  );
}

function WhoChip({
  label,
  on,
  onPress,
  c,
  glass,
  glassBorder,
  icon,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  c: ReturnType<typeof useOrbitColors>['c'];
  glass: (a?: number) => string;
  glassBorder: (a?: number) => string;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.whoChip,
        { backgroundColor: on ? `${c.primary}22` : glass(0.05), borderColor: on ? `${c.primary}66` : glassBorder(0.1) },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}>
      {icon}
      <Text style={[typography.caption1, { color: on ? c.text : c.textMuted, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

function Kpi({
  label,
  value,
  color,
  c,
  glass,
  glassBorder,
}: {
  label: string;
  value: string;
  color: string;
  c: ReturnType<typeof useOrbitColors>['c'];
  glass: (a?: number) => string;
  glassBorder: (a?: number) => string;
}) {
  return (
    <View style={[styles.kpi, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}>
      <View style={[styles.kpiDot, { backgroundColor: color }]} />
      <Text style={[typography.caption1, { color: c.textMuted }]}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  content: { paddingHorizontal: space.md, gap: space.md },
  rangeBar: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  rangeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  rangeText: { fontSize: 15, fontWeight: '700' },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  whoRow: { gap: 8 },
  whoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headline: { gap: 2 },
  headLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  headNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headNumber: { fontSize: 44, fontWeight: '700', letterSpacing: -1 },
  headUnit: { fontSize: 18, fontWeight: '600' },
  headSpan: { fontSize: 15, fontWeight: '600' },
  tick: { position: 'absolute', fontSize: 11, fontWeight: '600' },
  xLabels: { height: 16, marginTop: 6 },
  xLabel: { position: 'absolute', width: X_LABEL_W, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  kpiDot: { width: 8, height: 8, borderRadius: 4 },
  familyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  familyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  familyBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  familyFill: { height: 6, borderRadius: 3 },
  footnote: { fontSize: 12, lineHeight: 17 },
});
