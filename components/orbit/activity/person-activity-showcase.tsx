/**
 * Activity tab — House Rules-style per-person showcase.
 * Faces + streak energy + today's signals (visual, not a wall of text).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { Moji } from '@/components/orbit/moji/moji';
import { StreakDots } from '@/components/orbit/house-rules/visuals/streak-dots';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri } from '@/lib/game-levels';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { resolveHouseRulesPalette } from '@/lib/rules/house-rules-palette';
import {
  bestStreakAmongRows,
  selfStreakAmongRows,
  type MemberStreakRow,
} from '@/lib/streaks/member-streak-rows';
import { glassCardStrong, glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

const STREAK_TONE = '#FF6A3D';
const PERSON_TONES = ['#17B9A0', '#8E7CFF', '#FF9F1C', '#4FA3FF', '#E9B44C', '#FB7185'];

export type PersonSignal = {
  id: string;
  label: string;
  color: string;
  createdAt: string;
  memberId?: string;
  memberName?: string;
};

type Props = {
  rows: MemberStreakRow[];
  signals: PersonSignal[];
  mode: 'household' | 'personal';
  accentColor: string;
  onSelectPerson?: (memberId: string) => void;
};

function toneFor(index: number) {
  return PERSON_TONES[index % PERSON_TONES.length]!;
}

function startOfLocalDay(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayUnit(n: number) {
  return n === 1 ? 'day' : 'days';
}

function displayName(row: MemberStreakRow) {
  return row.isSelf ? 'You' : row.name;
}

function leaderCaption(leaders: MemberStreakRow[], lead = 0) {
  if (leaders.length === 0) return '';
  if (leaders.length === 1) {
    if (!leaders[0]!.isSelf) return leaders[0]!.name;
    return lead > 0 ? `You, by ${lead} ${dayUnit(lead)}` : 'That’s you';
  }
  if (leaders.length === 2) return `${displayName(leaders[0]!)} & ${displayName(leaders[1]!)}`;
  return `${leaders.length} tied`;
}

function selfCaption(selfStreak: number, houseBest: number, selfLeads: boolean) {
  if (selfStreak <= 0) return 'Finish a task to start';
  if (selfLeads) return 'Leading the house';
  const gap = houseBest - selfStreak;
  return `${gap} ${dayUnit(gap)} off the lead`;
}

function HeroStat({
  label,
  dot,
  value,
  caption,
  delay,
}: {
  label: string;
  dot: string;
  value: number;
  caption: string;
  delay: number;
}) {
  const { c, glassBorder, isDark } = useOrbitColors();
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(260)}
      style={[
        styles.heroStat,
        { backgroundColor: glassCardStrong(isDark), borderColor: glassBorder(0.08) },
      ]}>
      <View style={styles.heroStatHead}>
        <View style={[styles.heroStatDot, { backgroundColor: dot }]} />
        <Text style={[styles.heroStatLabel, { color: c.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.heroValueRow}>
        <Text
          style={[styles.heroValue, { color: c.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}>
          {value}
        </Text>
        <Text style={[styles.heroUnit, { color: c.textMuted }]}>{dayUnit(value)}</Text>
      </View>
      <Text style={[styles.heroStatCaption, { color: c.textMuted }]} numberOfLines={1}>
        {caption}
      </Text>
    </Animated.View>
  );
}

export function PersonActivityShowcase({
  rows,
  signals,
  mode,
  accentColor,
  onSelectPerson,
}: Props) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const doc = getHouseRulesDoc();
  const palette = resolveHouseRulesPalette(mode === 'household' ? 'admin' : 'sidekick');
  const dayStart = startOfLocalDay();

  const byPerson = useMemo(() => {
    return rows.map((row, index) => {
      const todays = signals.filter((s) => {
        const at = new Date(s.createdAt).getTime();
        if (at < dayStart) return false;
        if (s.memberId) return s.memberId === row.id;
        if (s.memberName) return s.memberName.toLowerCase() === row.name.toLowerCase();
        return false;
      });
      // Dedupe identical labels so chips don't repeat "Poppins · Tasks" twice.
      const seen = new Set<string>();
      const unique = todays.filter((s) => {
        const key = s.label.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return {
        row,
        tone: row.isSelf ? accentColor : toneFor(index),
        todayCount: todays.length,
        latest: unique.slice(0, 2),
      };
    });
  }, [accentColor, dayStart, rows, signals]);

  // Personal streaks only (same source as Home / Health). Household mode shows
  // best-in-house above and the viewer's personal streak beside it — never sum,
  // never swap in "faces active today" as the hero number.
  const houseBest = bestStreakAmongRows(rows);
  const selfStreak = selfStreakAmongRows(rows);
  const heroStreak = mode === 'household' ? houseBest : selfStreak;
  const leaders = houseBest > 0 ? rows.filter((r) => Math.max(0, r.streak) === houseBest) : [];
  const selfLeads = leaders.some((r) => r.isSelf);
  const runnerUp = rows.reduce(
    (next, r) => (r.streak < houseBest ? Math.max(next, Math.max(0, r.streak)) : next),
    0
  );
  const leadMargin = leaders.length === 1 && rows.length > 1 ? houseBest - runnerUp : 0;
  const activeToday = byPerson.filter((p) => p.todayCount > 0).length;
  const householdQuiet = houseBest <= 0 && selfStreak <= 0;

  if (!rows.length) return null;

  const isHousehold = mode === 'household';
  const householdTitle = householdQuiet
    ? 'Every streak starts today'
    : activeToday > 0
      ? `${activeToday} of ${rows.length} active today`
      : 'Quiet so far today';
  const personalTitle =
    selfStreak <= 0
      ? 'Every streak starts today'
      : `${selfStreak} ${dayUnit(selfStreak)} and counting`;
  const heroA11y = isHousehold
    ? householdQuiet
      ? 'Household energy. No active streaks yet.'
      : `Household energy. Best in house ${houseBest} ${dayUnit(houseBest)}, ${leaderCaption(
          leaders
        )}. Your streak ${selfStreak} ${dayUnit(selfStreak)}.`
    : `Your energy. ${selfStreak} ${dayUnit(selfStreak)} streak.`;

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.duration(260)}>
        <LinearGradient
          colors={[`${STREAK_TONE}2A`, `${STREAK_TONE}0D`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: `${STREAK_TONE}38` }]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={heroA11y}>
          <View style={styles.heroTop}>
            <View style={[styles.fireWell, { backgroundColor: `${STREAK_TONE}22` }]}>
              <Moji name="fire" size={22} />
            </View>
            <View style={styles.heroHeading}>
              <Text style={[styles.heroEyebrow, { color: STREAK_TONE }]}>
                {isHousehold ? 'Household energy' : 'Your energy'}
              </Text>
              <Text style={[typography.headline, { color: c.text }]} numberOfLines={1}>
                {isHousehold ? householdTitle : personalTitle}
              </Text>
            </View>
          </View>

          {isHousehold && !householdQuiet ? (
            <View style={styles.heroPair}>
              <HeroStat
                label="Best in house"
                dot={STREAK_TONE}
                value={houseBest}
                caption={leaderCaption(leaders, leadMargin)}
                delay={90}
              />
              <HeroStat
                label="You"
                dot={accentColor}
                value={selfStreak}
                caption={selfCaption(selfStreak, houseBest, selfLeads)}
                delay={140}
              />
            </View>
          ) : null}

          {isHousehold && householdQuiet ? (
            <Text style={[styles.heroSub, { color: c.textMuted }]}>
              Finish one task to light the first flame for the house.
            </Text>
          ) : null}

          {!isHousehold ? (
            <>
              <View style={styles.dots}>
                <StreakDots
                  constants={doc.constants}
                  palette={palette}
                  voice="sidekick"
                  liveStreakDays={heroStreak}
                />
              </View>
              <Text style={[styles.heroSub, { color: c.textMuted }]}>
                {selfStreak <= 0
                  ? 'Finish one task to light your first flame.'
                  : 'Finish-by keeps Late Credit safe.'}
              </Text>
            </>
          ) : null}
        </LinearGradient>
      </Animated.View>

      <View style={styles.grid}>
        {byPerson.map(({ row, tone, todayCount, latest }, index) => {
          const photo = isAvatarImageUri(row.avatar);
          return (
            <Animated.View
              key={row.id}
              entering={FadeInDown.delay(80 + index * 45).duration(280)}
              style={styles.tileWrap}>
              <Pressable
                onPress={() => onSelectPerson?.(row.id)}
                disabled={!onSelectPerson}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: `${tone}12`,
                    borderColor: `${tone}33`,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                accessibilityRole={onSelectPerson ? 'button' : 'summary'}
                accessibilityLabel={`${displayName(row)}, ${row.streak} ${dayUnit(row.streak)} streak, ${todayCount} ${
                  todayCount === 1 ? 'signal' : 'signals'
                } today`}>
                <View style={styles.tileTop}>
                  <Avatar
                    name={row.name}
                    emoji={photo ? undefined : row.avatar}
                    imageUri={photo ? row.avatar : undefined}
                    size="s"
                  />
                  <View style={[styles.streakPill, { backgroundColor: `${tone}2E` }]}>
                    <Moji name="fire" size={12} />
                    <Text style={[styles.streakNum, { color: tone }]}>{row.streak}</Text>
                  </View>
                </View>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {displayName(row)}
                </Text>
                <Text style={[styles.stat, { color: c.textMuted }]} numberOfLines={1}>
                  <Text style={[styles.statCount, { color: tone }]}>{todayCount}</Text>
                  {todayCount === 1 ? ' signal today' : ' signals today'}
                </Text>
                {latest.length > 0 ? (
                  <View style={styles.signalRow}>
                    {latest.map((sig) => (
                      <View
                        key={sig.id}
                        style={[
                          styles.signalChip,
                          {
                            backgroundColor: glassFill(isDark),
                            borderColor: `${sig.color}55`,
                          },
                        ]}>
                        <View style={[styles.signalDot, { backgroundColor: sig.color }]} />
                        <Text style={[styles.signalText, { color: c.textSoft }]} numberOfLines={1}>
                          {sig.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.idle,
                      { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.08) },
                    ]}>
                    <Text style={[styles.idleText, { color: c.textSubtle }]}>Quiet so far</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  hero: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    gap: space.sm,
    overflow: 'hidden',
    padding: space.md,
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: space.sm },
  heroHeading: { flex: 1, gap: 2, minWidth: 0 },
  fireWell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  heroPair: { flexDirection: 'row', gap: space.xs },
  heroStat: {
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  heroStatHead: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  heroStatDot: { borderRadius: 3, height: 6, width: 6 },
  heroStatLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, marginTop: 2 },
  heroValue: {
    ...typography.metricLarge,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  heroUnit: { fontSize: 13, fontWeight: '600' },
  heroStatCaption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  heroSub: { ...typography.footnote },
  dots: { marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tileWrap: { width: '48%' },
  tile: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minHeight: 128,
    padding: 12,
  },
  tileTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  streakPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  streakNum: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  stat: { fontSize: 12, lineHeight: 16 },
  statCount: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  signalRow: { gap: 4, marginTop: 6 },
  signalChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  signalDot: { borderRadius: 3, height: 6, width: 6 },
  signalText: { flex: 1, fontSize: 10.5, fontWeight: '700' },
  idle: {
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  idleText: { fontSize: 11, fontWeight: '700' },
});
