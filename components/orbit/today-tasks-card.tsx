import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FireEdgeProgress } from '@/components/orbit/fire-edge-progress';
import { GlassCard } from '@/components/orbit/glass-card';
import { orbitColors } from '@/constants/orbit-theme';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { taskMatchesAssignee } from '@/lib/tasks/split-assign';
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

function isTodayTask(task: HouseholdTask) {
  if (task.status === 'Cancelled') return false;
  return (
    /today/i.test(task.due) ||
    task.status === 'Overdue' ||
    task.status === 'Pending' ||
    task.status === 'In Progress' ||
    task.status === 'Completed'
  );
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
  const [size, setSize] = useState({ width: 0, height: 0 });

  const scoped = useMemo(() => {
    const today = tasks.filter(isTodayTask);
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
              <Text style={styles.sectionTitle}>
                {mineOnly ? 'My tasks today' : "Today's Tasks"}
              </Text>
              <Text style={styles.eyebrow}>
                {done} of {scoped.length} complete
                {complete ? ' · daily streak ready' : ''}
              </Text>
            </View>
            <View style={styles.rightMeta}>
              <View style={[styles.streakChip, complete && styles.streakChipHot]}>
                <MaterialIcons
                  name="local-fire-department"
                  size={14}
                  color={complete ? '#FB923C' : orbitColors.warning}
                />
                <Text style={[styles.streakText, complete && { color: '#FB923C' }]}>{streak}d</Text>
              </View>
              <View style={styles.pctPill}>
                <Text style={styles.pctPillText}>{pct}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressTrack}>
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
                    <Text style={styles.personEmoji}>{memberDisplayEmoji(row.member)}</Text>
                    <Text style={[styles.personName, { color: row.color }]} numberOfLines={1}>
                      {row.member.name}
                    </Text>
                    <Text style={styles.personCount}>
                      {row.done}/{row.total}
                    </Text>
                  </>
                );
                return (
                  <Animated.View
                    key={row.member.id}
                    entering={FadeInDown.delay(index * 60).springify()}>
                    {canFocusMembers ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${row.member.name}'s tasks`}
                        onPress={() => openTasksTab(row.member.name)}
                        style={[
                          styles.personChip,
                          styles.personChipPressable,
                          { borderColor: `${row.color}88`, backgroundColor: `${row.color}18` },
                        ]}>
                        {chip}
                      </Pressable>
                    ) : (
                      <View style={[styles.personChip, { borderColor: `${row.color}55` }]}>
                        {chip}
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          ) : null}

          {preview.length === 0 ? (
            <Text style={styles.eyebrow}>All clear for today.</Text>
          ) : (
            preview.map((task, index) => {
              const finished = task.status === 'Completed';
              return (
                <Animated.View key={task.id} entering={FadeInDown.delay(80 + index * 40).springify()}>
                  <Pressable
                    style={styles.taskRow}
                    onPress={() => router.push(`/task/${task.id}` as never)}>
                    <View style={[styles.check, finished && styles.checkDone]}>
                      {finished ? <MaterialIcons name="check" size={12} color="#070D1C" /> : null}
                    </View>
                    <Text style={[styles.taskText, finished && styles.taskDone]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    {!mineOnly ? (
                      <Text style={styles.assignee}>{task.assignee?.[0] ?? '?'}</Text>
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
            <Text style={[styles.link, { color: accentTheme.primary }]}>Open tasks →</Text>
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
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  eyebrow: { color: orbitColors.textSubtle, fontSize: 12 },
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
    color: orbitColors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  pctPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pctPillText: {
    color: orbitColors.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  personCount: { color: orbitColors.textMuted, fontSize: 11, fontWeight: '700' },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  check: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  taskText: { color: orbitColors.textSoft, flex: 1, fontSize: 14, fontWeight: '600' },
  taskDone: { color: orbitColors.textSubtle, textDecorationLine: 'line-through' },
  assignee: { color: orbitColors.textSubtle, fontSize: 12, fontWeight: '700' },
  linkBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    paddingVertical: 4,
  },
  link: { fontSize: 13, fontWeight: '700' },
});
