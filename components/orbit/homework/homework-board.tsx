/**
 * The homework board — the top of the Homework tab.
 *
 *   ┌ THIS WEEK ─────────────────────────────┐
 *   │  ( 5/6 )   On time 80% · Due today 1   │
 *   │   done     Overdue 1                   │
 *   ├ Math ▮▮▯  Reading ▮▮▮  Science ▮▯ …    │  subject chips, done / total
 *   ├ READING  3-day streak  M T W T F S S   │  dots on days read
 *   │          3 sessions · 20 min · 11 pages│
 *   └ Mia 2/3 · 1 due today   Noah 3/3        │  per child (adults only)
 *
 * Numbers come from lib/tasks/homework-stats (tested); this file only draws them.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { space, typography } from '@/constants/orbit-theme';
import { homeworkStats } from '@/lib/tasks/homework-stats';
import { homeworkSubjectMeta } from '@/lib/tasks/homework-subject';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

type Props = {
  tasks: HouseholdTask[];
  members: HouseholdMember[];
  /** Show the per-child rows (adults looking at the house). */
  showChildren: boolean;
  /** Whose board this is, for the empty line ("Mia's week"). */
  ownerName?: string;
};

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function HomeworkBoard({ tasks, members, showChildren, ownerName }: Props) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const stats = useMemo(() => homeworkStats(tasks), [tasks]);
  const { week } = stats;
  const reading = stats.reading;
  const hasReading = reading.sessions > 0 || reading.streak > 0;
  const accent = c.planPurple;
  const track = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.08)';

  if (week.assigned === 0 && stats.overdue === 0 && !hasReading) {
    return (
      <GlassCard style={styles.card}>
        <View style={styles.emptyRow}>
          <Moji name="books" size={32} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.headline, { color: c.text }]}>
              {ownerName ? `${ownerName}'s week is clear` : 'No homework this week'}
            </Text>
            <Text style={[typography.footnote, { color: c.textMuted }]}>
              New homework lands here with its subject, due day and progress.
            </Text>
          </View>
        </View>
      </GlassCard>
    );
  }

  const onTime = stats.onTimeRate == null ? '—' : `${Math.round(stats.onTimeRate * 100)}%`;

  return (
    <GlassCard style={styles.card}>
      <Text style={[typography.eyebrow, { color: c.textSubtle }]}>This week</Text>

      {/* Ring + the three numbers that matter */}
      <View style={styles.topRow}>
        <ProgressRing done={week.done} total={week.assigned} color={accent} track={track} textColor={c.text} muted={c.textMuted} />
        <View style={styles.tiles}>
          <Tile label="On time" value={onTime} color={c.success} glass={glass(0.05)} border={glassBorder(0.08)} text={c.text} muted={c.textMuted} />
          <Tile
            label="Due today"
            value={String(stats.dueToday)}
            color={stats.dueToday ? accent : c.textMuted}
            glass={glass(0.05)}
            border={glassBorder(0.08)}
            text={c.text}
            muted={c.textMuted}
          />
          <Tile
            label="Overdue"
            value={String(stats.overdue)}
            color={stats.overdue ? c.warning : c.textMuted}
            glass={glass(0.05)}
            border={glassBorder(0.08)}
            text={c.text}
            muted={c.textMuted}
          />
        </View>
      </View>

      {/* Subjects */}
      {stats.bySubject.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjects}>
          {stats.bySubject.map((row) => {
            const meta = homeworkSubjectMeta(row.subject);
            const pct = row.total ? row.done / row.total : 0;
            return (
              <View
                key={row.subject}
                style={[styles.subjectChip, { backgroundColor: `${meta.color}14`, borderColor: `${meta.color}33` }]}
                accessibilityLabel={`${row.subject}: ${row.done} of ${row.total} done`}>
                <Moji emoji={meta.emoji} size={18} />
                <View style={{ gap: 4 }}>
                  <Text style={[typography.caption1, { color: c.text, fontWeight: '700' }]}>
                    {row.subject}{' '}
                    <Text style={[typography.caption1, { color: c.textMuted }]}>
                      {row.done}/{row.total}
                    </Text>
                  </Text>
                  <View style={[styles.bar, { backgroundColor: track }]}>
                    <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Reading */}
      {hasReading ? (
        <View style={[styles.reading, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}>
          <View style={styles.readingHead}>
            <Moji name="book" size={24} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.eyebrow, { color: c.textSubtle }]}>Reading</Text>
              <Text style={[typography.headline, { color: c.text }]}>
                {reading.streak > 0
                  ? `${reading.streak}-day streak`
                  : `${reading.sessions} session${reading.sessions === 1 ? '' : 's'} this week`}
              </Text>
            </View>
            {reading.streak >= 3 ? <Moji name="fire" size={22} /> : null}
          </View>
          <View style={styles.days}>
            {reading.days.map((read, index) => (
              <View key={index} style={styles.dayCol}>
                <View
                  style={[
                    styles.dayDot,
                    read
                      ? { backgroundColor: accent }
                      : { borderColor: track, borderWidth: 1.5, backgroundColor: 'transparent' },
                  ]}
                />
                <Text style={[styles.dayLetter, { color: read ? c.text : c.textSubtle }]}>
                  {DAY_LETTERS[index]}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            {[
              `${reading.sessions} session${reading.sessions === 1 ? '' : 's'}`,
              reading.minutes ? `${reading.minutes} min` : '',
              reading.pages ? `${reading.pages} page${reading.pages === 1 ? '' : 's'}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : null}

      {/* Per child */}
      {showChildren && stats.byChild.length ? (
        <View style={styles.children}>
          {stats.byChild.map((row) => {
            const member = members.find((m) => m.name === row.name);
            const pct = row.total ? row.done / row.total : 0;
            return (
              <View key={row.name} style={styles.childRow}>
                <MemberGlyph member={member ?? { name: row.name }} size={18} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.childTop}>
                    <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>{row.name}</Text>
                    <Text style={[typography.caption1, { color: c.textMuted }]}>
                      {row.done}/{row.total}
                      {row.dueToday ? ` · ${row.dueToday} due today` : ''}
                    </Text>
                  </View>
                  <View style={[styles.bar, { backgroundColor: track }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.round(pct * 100)}%`, backgroundColor: pct >= 1 ? c.success : accent },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </GlassCard>
  );
}

function ProgressRing({
  done,
  total,
  color,
  track,
  textColor,
  muted,
}: {
  done: number;
  total: number;
  color: string;
  track: string;
  textColor: string;
  muted: string;
}) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total ? Math.min(1, done / total) : 0;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${done} of ${total} homework done this week`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={{ color: textColor, fontSize: 22, fontWeight: '800' }}>
          {done}
          <Text style={{ color: muted, fontSize: 15, fontWeight: '700' }}>/{total}</Text>
        </Text>
        <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>done</Text>
      </View>
    </View>
  );
}

function Tile({
  label,
  value,
  color,
  glass,
  border,
  text,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  glass: string;
  border: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: glass, borderColor: border }]}>
      <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: value === '0' || value === '—' ? text : color, fontSize: 17, fontWeight: '800' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginBottom: space.md },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  tiles: { flex: 1, flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  subjects: { gap: 8, paddingVertical: 2 },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 108,
  },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden', minWidth: 60 },
  barFill: { height: 5, borderRadius: 3 },
  reading: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  readingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  days: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayCol: { alignItems: 'center', gap: 4 },
  dayDot: { width: 14, height: 14, borderRadius: 7 },
  dayLetter: { fontSize: 11, fontWeight: '700' },
  children: { gap: 10, marginTop: 2 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  childTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
