/**
 * Where the month's actions went, day by day.
 *
 * Deliberately the same dashboard as the completed-tasks one — the range bar, the big headline
 * over its span, stacked bars you can tap, then the split underneath — so that once you've read
 * one of these you can read both.
 *
 * Numbers: lib/ai/credit-breakdown (tested). Only charged actions appear; anything undone or
 * vetoed was refunded in the meter, so it isn't on the chart either.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { typography } from '@/constants/orbit-theme';
import {
  TOKENS_PER_MONTH,
  TOKEN_WEIGHT_SPEAK_BACK,
} from '@/constants/poppins-ai-rates';
import type { ActEvent } from '@/lib/ai/act-events';
import {
  BREAKDOWN_RANGES,
  computeCreditBreakdown,
  creditEvents,
  daysOfCreditsLeft,
  formatCredits,
  niceMax,
  SPEND_META,
  SPEND_ORDER,
  type BreakdownRange,
  type CreditBucket,
} from '@/lib/ai/credit-breakdown';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const CHART_HEIGHT = 200;
const AXIS_W = 40;

type Props = {
  events: ActEvent[];
  /** Only this member's actions, for a Sidekick looking at their own. */
  onlyMemberName?: string | null;
  /** Actions bought that haven't been spent. */
  topUpBalance: number;
  isAdmin: boolean;
};

export function CreditBreakdownView({ events, onlyMemberName, topUpBalance, isAdmin }: Props) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const [range, setRange] = useState<BreakdownRange>('W');
  const [selected, setSelected] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const all = creditEvents(events);
    return onlyMemberName ? all.filter((row) => row.by === onlyMemberName) : all;
  }, [events, onlyMemberName]);

  const breakdown = useMemo(() => computeCreditBreakdown(rows, range, now), [rows, range, now]);
  const peak = Math.max(0, ...breakdown.buckets.map((bucket) => bucket.credits));
  const top = niceMax(Math.max(peak, 4));

  const sel = selected != null ? breakdown.buckets[selected] : null;
  const headLabel = sel
    ? sel.title.toUpperCase()
    : breakdown.headline.kind === 'average'
      ? 'AVERAGE'
      : 'TOTAL';
  const headNumber = sel ? formatCredits(sel.credits) : formatCredits(breakdown.headline.credits);
  const headUnit = `action${(sel ? sel.credits : Math.round(breakdown.headline.credits)) === 1 ? '' : 's'}${
    !sel && breakdown.headline.kind === 'average' ? ' a day' : ''
  }`;

  // Pace, so the chart answers the question people actually have.
  const monthUsed = useMemo(
    () => computeCreditBreakdown(rows, 'M', now).totals.credits,
    [rows, now]
  );
  const perDay = computeCreditBreakdown(rows, 'W', now).headline.credits;
  const remaining = Math.max(0, TOKENS_PER_MONTH - monthUsed) + topUpBalance;
  const daysLeft = daysOfCreditsLeft(remaining, perDay);

  return (
    <>
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
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={{ D: 'Day', W: 'Week', M: 'Month', '6M': 'Six months', Y: 'Year' }[r]}
              style={[
                styles.rangeBtn,
                on && {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,28,42,0.12)',
                },
              ]}>
              <Text style={[styles.rangeText, { color: on ? c.text : c.textMuted }]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Headline */}
      <View style={styles.headline}>
        <Text style={[styles.headLabel, { color: c.textMuted }]}>{headLabel}</Text>
        <View style={styles.headRow}>
          <Text style={[styles.headNumber, { color: c.text }]}>{headNumber}</Text>
          <Text style={[styles.headUnit, { color: c.textMuted }]}>{headUnit}</Text>
        </View>
        <Text style={[styles.headSpan, { color: c.textMuted }]}>{breakdown.span}</Text>
      </View>

      <CreditChart
        buckets={breakdown.buckets}
        top={top}
        selected={selected}
        onSelect={(index) => setSelected(selected === index ? null : index)}
        grid={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,28,42,0.12)'}
        text={c.textMuted}
      />

      {/* The three numbers worth knowing. */}
      <View style={styles.kpis}>
        <Kpi label="Actions" value={String(breakdown.totals.actions)} color={c.primary} />
        <Kpi
          label="Spent talking"
          value={`${Math.round(
            breakdown.totals.credits ? (breakdown.totals.spokenCredits / breakdown.totals.credits) * 100 : 0
          )}%`}
          color="#8E7CFF"
        />
        <Kpi
          label={topUpBalance > 0 ? 'Left (with top-ups)' : 'Left this month'}
          value={String(remaining)}
          color={c.success}
        />
      </View>

      {daysLeft != null && daysLeft < 40 ? (
        <Text style={[styles.pace, { color: c.textMuted }]}>
          At this week&apos;s pace that&apos;s about {daysLeft} more day{daysLeft === 1 ? '' : 's'}.
        </Text>
      ) : null}

      {/* What spent them. */}
      <GlassCard style={{ gap: 12 }}>
        <Text style={[typography.eyebrow, { color: c.textSubtle }]}>
          {sel ? `What spent them · ${sel.title}` : 'What spent them'}
        </Text>
        {(sel
          ? SPEND_ORDER.filter((g) => sel.byGroup[g]).map((g) => ({ group: g, ...sel.byGroup[g]! }))
          : breakdown.byGroup
        ).map((row) => {
          const meta = SPEND_META[row.group];
          const total = sel ? sel.credits : breakdown.totals.credits;
          const pct = total ? row.credits / total : 0;
          return (
            <View key={row.group} style={styles.groupRow}>
              <Moji name={meta.moji as MojiName} size={24} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={styles.groupTop}>
                  <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                    {meta.label}
                  </Text>
                  <Text style={[typography.footnote, { color: c.textMuted }]}>
                    {row.credits} · {row.actions} time{row.actions === 1 ? '' : 's'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.bar,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.08)' },
                  ]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(3, Math.round(pct * 100))}%`, backgroundColor: meta.color },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
        {breakdown.totals.credits === 0 ? (
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            Nothing spent in this range.
          </Text>
        ) : null}
      </GlassCard>

      {/* Who spent them. */}
      {isAdmin && breakdown.byMember.length > 0 ? (
        <GlassCard style={{ gap: 10 }}>
          <Text style={[typography.eyebrow, { color: c.textSubtle }]}>Who spent them</Text>
          {breakdown.byMember.map((row) => (
            <View key={row.name} style={styles.memberRow}>
              <Text style={[typography.subheadline, { color: c.text }]}>{row.name}</Text>
              <Text style={[typography.footnote, { color: c.textMuted }]}>
                {row.credits} action{row.credits === 1 ? '' : 's'}
              </Text>
            </View>
          ))}
        </GlassCard>
      ) : null}

      <Text style={[styles.footnote, { color: c.textSubtle, borderColor: glassBorder(0.1) }]}>
        Saving something with Poppins Base costs one action. Letting it talk back costs about{' '}
        {TOKEN_WEIGHT_SPEAK_BACK}, because speech is dearer to run. Anything you undo is given back.
      </Text>
    </>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  const { c, glass, glassBorder } = useOrbitColors();
  return (
    <View style={[styles.kpi, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function CreditChart({
  buckets,
  top,
  selected,
  onSelect,
  grid,
  text,
}: {
  buckets: CreditBucket[];
  top: number;
  selected: number | null;
  onSelect: (index: number) => void;
  grid: string;
  text: string;
}) {
  const [width, setWidth] = useState(0);
  const plotW = Math.max(0, width - AXIS_W);
  const slot = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.max(2, Math.min(26, slot * 0.62));
  const h = CHART_HEIGHT;
  const ticks = [0, top / 2, top];

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ marginTop: 4 }}>
      <View style={{ height: h }}>
        {width > 0 ? (
          <Svg width={width} height={h}>
            {ticks.map((tick) => {
              const y = h - (tick / top) * (h - 8) - 0.5;
              return (
                <Line
                  key={tick}
                  x1={0}
                  x2={plotW}
                  y1={y}
                  y2={y}
                  stroke={grid}
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                />
              );
            })}
            {buckets.map((bucket, index) => {
              const x = index * slot + (slot - barW) / 2;
              let y = h;
              const dim = selected != null && selected !== index;
              // Stacked by what spent them, bottom-up in the same order every time.
              return SPEND_ORDER.filter((group) => bucket.byGroup[group]).map((group) => {
                const credits = bucket.byGroup[group]!.credits;
                const height = Math.max(1.5, (credits / top) * (h - 8));
                y -= height;
                return (
                  <Rect
                    key={`${index}-${group}`}
                    x={x}
                    y={y}
                    width={barW}
                    height={height}
                    rx={Math.min(3, barW / 2)}
                    fill={SPEND_META[group].color}
                    opacity={dim ? 0.3 : 1}
                  />
                );
              });
            })}
          </Svg>
        ) : null}
        {/* Tap targets sit over the bars so a thin bar is still tappable. */}
        <View style={styles.taps} pointerEvents="box-none">
          {buckets.map((bucket, index) => (
            <Pressable
              key={index}
              onPress={() => onSelect(index)}
              accessibilityRole="button"
              accessibilityLabel={`${bucket.title}: ${bucket.credits} actions`}
              style={{ width: slot, height: h }}
            />
          ))}
        </View>
      </View>
      {/* Axis */}
      <View style={styles.axisRow}>
        {buckets.map((bucket, index) => (
          <Text
            key={index}
            style={[styles.axisLabel, { color: text, width: slot }]}
            numberOfLines={1}>
            {bucket.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeBar: { borderRadius: 12, flexDirection: 'row', gap: 2, padding: 3 },
  rangeBtn: { alignItems: 'center', borderRadius: 9, flex: 1, paddingVertical: 7 },
  rangeText: { fontSize: 13, fontWeight: '700' },
  headline: { gap: 2, marginTop: 14 },
  headLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  headRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 6 },
  headNumber: { fontSize: 40, fontWeight: '900', letterSpacing: -1, lineHeight: 44 },
  headUnit: { fontSize: 15, fontWeight: '600', paddingBottom: 6 },
  headSpan: { fontSize: 13 },
  taps: { bottom: 0, flexDirection: 'row', left: 0, position: 'absolute', right: 0, top: 0 },
  axisRow: { flexDirection: 'row', marginTop: 4 },
  axisLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  kpis: { flexDirection: 'row', gap: 8, marginTop: 16 },
  kpi: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  kpiValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  kpiLabel: { fontSize: 11, lineHeight: 14 },
  pace: { fontSize: 12.5, marginTop: 8, paddingHorizontal: 2 },
  groupRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  groupTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bar: { borderRadius: 4, height: 7, overflow: 'hidden' },
  barFill: { borderRadius: 4, height: 7 },
  memberRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  footnote: { fontSize: 11.5, lineHeight: 16, paddingHorizontal: 2 },
});
