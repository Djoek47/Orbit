import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Avatar } from '@/components/orbit/avatar';
import { FireEdgeProgress } from '@/components/orbit/fire-edge-progress';
import { GlassCard } from '@/components/orbit/glass-card';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { isAvatarImageUri, MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { taskMatchesAssignee } from '@/lib/tasks/split-assign';
import { isTodayTask } from '@/lib/tasks/today';
import type { AccentTheme } from '@/constants/accent-themes';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

type TodayTasksCardProps = {
  tasks: HouseholdTask[];
  members: HouseholdMember[];
  currentMember?: HouseholdMember | null;
  accentTheme: AccentTheme;
  /** Admin / household managers can open a member’s Tasks view from the chips. */
  canFocusMembers?: boolean;
  mineOnly?: boolean;
  streak: number;
  onAwardDailyStreak?: () => void;
};

function openTasksTab(memberName?: string) {
  // Always pass `member` so a prior person focus does not stick on the Tasks tab.
  router.push({
    pathname: '/tasks',
    params: { member: memberName ?? '' },
  } as never);
}

function PersonChipEnter({ index, children }: { index: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withDelay(index * 70, withSpring(1, { damping: 18, stiffness: 160 }));
    translateY.value = withDelay(index * 70, withSpring(0, { damping: 18, stiffness: 160 }));
  }, [index, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function TodayTasksCard({
  tasks,
  members,
  currentMember,
  accentTheme,
  canFocusMembers = false,
  mineOnly = false,
  streak,
  onAwardDailyStreak,
}: TodayTasksCardProps) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const scoped = useMemo(() => {
    const today = tasks.filter((task) => isTodayTask(task));
    if (mineOnly && currentMember) {
      return today.filter((task) => taskMatchesAssignee(task, currentMember.name));
    }
    return today;
  }, [currentMember, mineOnly, tasks]);

  const done = scoped.filter((task) => task.status === 'Completed').length;
  const total = Math.max(1, scoped.length);
  const pct = Math.round((done / total) * 100);
  const progress = scoped.length === 0 ? 0 : done / scoped.length;
  const complete = scoped.length > 0 && done === scoped.length;

  const perPerson = useMemo(() => {
    if (mineOnly) return [];
    return members
      .filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          !isSharedDeviceRole(member.role)
      )
      .map((member) => {
        const theirs = scoped.filter((task) => taskMatchesAssignee(task, member.name));
        const finished = theirs.filter((task) => task.status === 'Completed').length;
        return {
          member,
          done: finished,
          total: theirs.length,
          color: MEMBER_ACCENTS[member.name]?.color ?? accentTheme.primary,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.done / Math.max(1, b.total) - a.done / Math.max(1, a.total));
  }, [accentTheme.primary, members, mineOnly, scoped]);

  const preview = scoped
    .filter((task) => task.status !== 'Completed')
    .slice(0, mineOnly ? 6 : 4)
    .concat(scoped.filter((task) => task.status === 'Completed').slice(0, 2))
    .slice(0, mineOnly ? 6 : 5);

  useEffect(() => {
    if (complete && onAwardDailyStreak) {
      onAwardDailyStreak();
    }
  }, [complete, onAwardDailyStreak]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <FireEdgeProgress
        progress={progress}
        width={size.width || 1}
        height={size.height || 1}
        radius={24}>
        <GlassCard style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                {mineOnly ? 'My tasks today' : "Today's Tasks"}
              </Text>
              <Text style={[styles.eyebrow, { color: c.textSubtle }]}>
                {done} of {scoped.length} complete
                {complete ? ' · daily streak ready' : ''}
              </Text>
            </View>
            <View style={styles.rightMeta}>
              <View style={[styles.streakChip, complete && styles.streakChipHot]}>
                <MaterialIcons
                  name="local-fire-department"
                  size={14}
                  color={complete ? '#FB923C' : c.warning}
                />
                <Text style={[styles.streakText, { color: complete ? '#FB923C' : c.warning }]}>
                  {streak}d
                </Text>
              </View>
              <View
                style={[
                  styles.pctPill,
                  { backgroundColor: glass(0.08) },
                ]}>
                <Text style={[styles.pctPillText, { color: c.textSoft }]}>{pct}%</Text>
              </View>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: glass(0.08) }]}>
            <LinearGradient
              colors={complete ? ['#FB923C', '#FBBF24'] : [accentTheme.primary, accentTheme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${pct}%` }]}
            />
          </View>

          {!mineOnly && perPerson.length > 0 ? (
            <View style={styles.personRow}>
              {perPerson.map((row, index) => {
                const chip = (
                  <>
                    <Avatar
                      name={row.member.name}
                      emoji={memberDisplayEmoji(row.member)}
                      imageUri={
                        isAvatarImageUri(row.member.avatar) ? row.member.avatar : undefined
                      }
                      size="xs"
                    />
                    <Text style={[styles.personName, { color: row.color }]} numberOfLines={1}>
                      {row.member.name}
                    </Text>
                    <Text style={[styles.personCount, { color: c.textMuted }]}>
                      {row.done}/{row.total}
                    </Text>
                  </>
                );
                return (
                  <PersonChipEnter key={row.member.id} index={index}>
                    {canFocusMembers ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${row.member.name}'s tasks`}
                        onPress={() => openTasksTab(row.member.name)}
                        style={[
                          styles.personChip,
                          styles.personChipPressable,
                          {
                            borderColor: `${row.color}88`,
                            backgroundColor: `${row.color}18`,
                          },
                        ]}>
                        {chip}
                      </Pressable>
                    ) : (
                      <View
                        style={[
                          styles.personChip,
                          {
                            borderColor: `${row.color}55`,
                            backgroundColor: glassFill(isDark, 0.04),
                          },
                        ]}>
                        {chip}
                      </View>
                    )}
                  </PersonChipEnter>
                );
              })}
            </View>
          ) : null}

          {preview.length === 0 ? (
            <Text style={[styles.eyebrow, { color: c.textSubtle }]}>All clear for today.</Text>
          ) : (
            preview.map((task, index) => {
              const finished = task.status === 'Completed';
              return (
                <Animated.View key={task.id} entering={FadeInDown.delay(80 + index * 40).springify()}>
                  <Pressable
                    style={styles.taskRow}
                    onPress={() => router.push(`/task/${task.id}` as never)}>
                    <View
                      style={[
                        styles.check,
                        { borderColor: glassBorder(0.2) },
                        finished && styles.checkDone,
                      ]}>
                      {finished ? <MaterialIcons name="check" size={12} color={c.ink} /> : null}
                    </View>
                    <Text
                      style={[
                        styles.taskText,
                        { color: finished ? c.textSubtle : c.text },
                        finished && styles.taskDone,
                      ]}
                      numberOfLines={1}>
                      {task.title}
                    </Text>
                    {!mineOnly ? (
                      <Text style={[styles.assignee, { color: c.textSubtle }]}>
                        {task.assignee?.[0] ?? '?'}
                      </Text>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open tasks"
            hitSlop={12}
            onPress={() => openTasksTab()}
            style={styles.linkBtn}>
            <Text style={[styles.link, { color: accentTheme.primary, textAlign: 'center' }]}>
              Open tasks →
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={accentTheme.primary} />
          </Pressable>
        </GlassCard>
      </FireEdgeProgress>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', width: '100%' },
  card: { gap: 10 },
  sectionHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  eyebrow: { fontSize: 12 },
  rightMeta: { alignItems: 'flex-end', gap: 6 },
  streakChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(251,146,60,0.12)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakChipHot: {
    backgroundColor: 'rgba(251,146,60,0.28)',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pctPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pctPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 999,
    height: 8,
  },
  personRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  personChipPressable: {
    minHeight: 32,
  },
  personEmoji: { fontSize: 14 },
  personName: { fontSize: 12, fontWeight: '700', maxWidth: 72 },
  personCount: { fontSize: 11, fontWeight: '700' },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  check: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  taskText: { flex: 1, fontSize: 14, fontWeight: '600' },
  taskDone: { textDecorationLine: 'line-through' },
  assignee: { fontSize: 12, fontWeight: '700' },
  linkBtn: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    marginTop: 2,
    paddingVertical: 4,
  },
  link: { fontSize: 13, fontWeight: '700' },
});
