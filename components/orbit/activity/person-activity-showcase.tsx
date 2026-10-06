/**
 * Activity tab — House Rules-style per-person showcase.
 * Faces + streak energy + today's signals (visual, not a wall of text).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { Moji } from '@/components/orbit/moji/moji';
import { StreakDots } from '@/components/orbit/house-rules/visuals/streak-dots';
import { isAvatarImageUri } from '@/lib/game-levels';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { resolveHouseRulesPalette } from '@/lib/rules/house-rules-palette';
import type { MemberStreakRow } from '@/lib/streaks/member-streak-rows';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

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
      return {
        row,
        tone: row.isSelf ? accentColor : toneFor(index),
        todayCount: todays.length,
        latest: todays.slice(0, 2),
      };
    });
  }, [accentColor, dayStart, rows, signals]);

  const houseStreak = rows.reduce((sum, r) => sum + Math.max(0, r.streak), 0);
  const activeToday = byPerson.filter((p) => p.todayCount > 0).length;

  if (!rows.length) return null;

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.duration(260)}>
        <LinearGradient
          colors={[`${STREAK_TONE}40`, `${STREAK_TONE}12`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: `${STREAK_TONE}55` }]}>
          <View style={styles.heroTop}>
            <View style={[styles.fireWell, { backgroundColor: `${STREAK_TONE}28` }]}>
              <Moji name="fire" size={26} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[styles.heroEyebrow, { color: STREAK_TONE }]}>
                {mode === 'household' ? 'Household energy' : 'Your energy'}
              </Text>
              <Text style={[styles.heroTitle, { color: c.text }]}>
                {mode === 'household'
                  ? `${houseStreak} streak days across the house`
                  : `${rows[0]?.streak ?? 0} day streak`}
              </Text>
            </View>
            <Text style={[styles.heroBig, { color: STREAK_TONE }]}>
              {mode === 'household' ? activeToday : rows[0]?.streak ?? 0}
            </Text>
          </View>
          <Text style={[styles.heroSub, { color: c.textMuted }]}>
            {mode === 'household'
              ? activeToday > 0
                ? `${activeToday} face${activeToday === 1 ? '' : 's'} lit up today`
                : 'Waiting for today’s first signals'
              : 'Finish-by keeps Late Credit safe'}
          </Text>
          {mode === 'personal' && rows[0] ? (
            <View style={styles.dots}>
              <StreakDots
                constants={doc.constants}
                palette={palette}
                voice="sidekick"
                liveStreakDays={rows[0].streak}
              />
            </View>
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
                    backgroundColor: `${tone}17`,
                    borderColor: `${tone}44`,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                accessibilityRole="summary"
                accessibilityLabel={`${row.name}, ${row.streak} day streak, ${todayCount} signals today`}>
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
                  {row.isSelf ? 'You' : row.name}
                </Text>
                <Text style={[styles.stat, { color: c.textMuted }]} numberOfLines={1}>
                  <Text style={{ color: tone, fontWeight: '800' }}>{todayCount}</Text>
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
  root: { gap: 12 },
  hero: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
    padding: 14,
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  fireWell: {
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  heroBig: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  heroSub: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  dots: { marginTop: 4 },
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
  streakNum: { fontSize: 12, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  stat: { fontSize: 12, lineHeight: 15 },
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
