import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import {
  orbitColors,
  orbitRadius,
  orbitScreen,
  orbitSpacing,
  orbitTypography,
} from '@/constants/orbit-theme';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { getAdminMembers, resolveSplitPair } from '@/lib/household/admins';
import {
  isSharedDeviceMember,
  isSharedDeviceRole,
  sharedDeviceAssigneeNames,
} from '@/lib/household/shared-device';
import { isSplitTask, taskMatchesAssignee } from '@/lib/tasks/split-assign';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdRoom, HouseholdTask } from '@/types/orbit';

type TaskFilter = 'all' | 'mine' | 'split' | 'kids' | 'homework';

const SUBJECT_COLORS: Record<string, { color: string; emoji: string }> = {
  Math: { color: '#38BDF8', emoji: '🔢' },
  English: { color: '#A78BFA', emoji: '📖' },
  Science: { color: '#34D399', emoji: '🧪' },
  History: { color: '#FB923C', emoji: '🏛️' },
  Art: { color: '#F472B6', emoji: '🎨' },
  PE: { color: '#FBBF24', emoji: '⚽' },
  Homework: { color: '#A78BFA', emoji: '📚' },
};

const PRIORITY_COLORS = {
  easy: '#34D399',
  medium: '#38BDF8',
  hard: '#FB923C',
} as const;

const FILTER_TABS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'split', label: 'Two admins' },
  { id: 'kids', label: 'Kids' },
  { id: 'homework', label: 'Homework' },
];

const GRADIENT_BY_COLOR: Record<string, [string, string]> = {
  '#38BDF8': ['#38BDF8', '#0EA5E9'],
  '#A78BFA': ['#A78BFA', '#7C3AED'],
  '#34D399': ['#34D399', '#059669'],
  '#FB923C': ['#FB923C', '#EA580C'],
  '#F472B6': ['#F472B6', '#EC4899'],
  '#FBBF24': ['#FBBF24', '#D97706'],
  '#94A3B8': ['#94A3B8', '#64748B'],
};

function isHomework(task: HouseholdTask) {
  return /homework/i.test(task.category) || /homework/i.test(task.title);
}

function isDueToday(task: HouseholdTask) {
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  return /today/i.test(task.due) || task.status === 'Overdue';
}

function isUpcoming(task: HouseholdTask) {
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  return !isDueToday(task);
}

function getMember(members: HouseholdMember[], assignee: string) {
  return members.find((member) => member.name === assignee);
}

function getSubjectMeta(task: HouseholdTask) {
  if (!isHomework(task)) return null;
  const key =
    Object.keys(SUBJECT_COLORS).find(
      (subject) => subject !== 'Homework' && new RegExp(subject, 'i').test(`${task.category} ${task.title} ${task.description ?? ''}`)
    ) ?? 'Homework';
  return { ...SUBJECT_COLORS[key], label: key };
}

function getPriorityColor(task: HouseholdTask) {
  if (task.difficulty && task.difficulty in PRIORITY_COLORS) {
    return PRIORITY_COLORS[task.difficulty];
  }
  if (isHomework(task)) return orbitColors.planPurple;
  return PRIORITY_COLORS.medium;
}

function memberAccentColor(member?: HouseholdMember) {
  if (!member) return orbitColors.success;
  return MEMBER_ACCENTS[member.name]?.color ?? orbitColors.success;
}

function XPBadge({ xp, done, accent }: { xp: number; done: boolean; accent: string }) {
  return (
    <View style={[styles.xpBadge, done && styles.xpBadgeDone, !done && { backgroundColor: `${accent}1F` }]}>
      <Text style={styles.xpBolt}>⚡</Text>
      <Text style={[styles.xpBadgeText, done && styles.xpBadgeTextDone, !done && { color: accent }]}>+{xp}</Text>
    </View>
  );
}

function TaskItem({
  task,
  member,
  room,
  accentPrimary,
  justCompleted,
  onToggle,
}: {
  task: HouseholdTask;
  member?: HouseholdMember;
  room?: HouseholdRoom;
  accentPrimary: string;
  justCompleted: boolean;
  onToggle: () => void;
}) {
  const shareDone =
    member && isSplitTask(task)
      ? task.shares?.find((share) => share.name === member.name)?.status === 'Completed'
      : undefined;
  const done = shareDone ?? task.status === 'Completed';
  const sub = getSubjectMeta(task);
  const accent = memberAccentColor(member);
  const borderColor = done
    ? accent
    : `${isHomework(task) ? (sub?.color ?? orbitColors.planPurple) : getPriorityColor(task)}80`;
  const avatarGradient = GRADIENT_BY_COLOR[accent] ?? [accent, accent];

  return (
    <View style={[styles.taskItem, done && styles.taskItemDone]}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.checkbox,
          {
            borderColor,
            backgroundColor: done ? accent : 'transparent',
          },
        ]}>
        {done ? <MaterialIcons name="check" size={12} color={orbitColors.ink} /> : null}
      </Pressable>

      <Pressable style={styles.taskBody} onPress={() => router.push(`/task/${task.id}` as never)}>
        <View style={styles.titleRow}>
          {isHomework(task) && sub ? (
            <View style={[styles.subjectPill, { backgroundColor: `${sub.color}18` }]}>
              <Text style={[styles.subjectPillText, { color: sub.color }]}>
                {sub.emoji} {sub.label}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <MaterialIcons name="schedule" size={10} color={orbitColors.textSubtle} />
          <Text style={styles.dueText}>{task.due}</Text>
          {isSplitTask(task) ? (
            <View style={[styles.metaPill, { backgroundColor: 'rgba(167,139,250,0.18)' }]}>
              <Text style={[styles.metaPillText, { color: '#A78BFA' }]}>Split</Text>
            </View>
          ) : null}
          {task.repeat !== 'None' ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{task.repeat}</Text>
            </View>
          ) : null}
          {room ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                {room.emoji} {room.name}
              </Text>
            </View>
          ) : null}
          {task.proofRequired ? (
            <View style={[styles.metaPill, { backgroundColor: 'rgba(251,146,60,0.15)' }]}>
              <Text style={[styles.metaPillText, { color: orbitColors.warning }]}>
                {task.proofStatus === 'submitted'
                  ? 'Proof review'
                  : task.proofStatus === 'approved'
                    ? 'Proof ✓'
                    : 'Proof'}
              </Text>
            </View>
          ) : null}
          {member ? (
            <LinearGradient colors={avatarGradient} style={styles.assigneeDot}>
              <Text style={styles.assigneeEmoji}>{memberDisplayEmoji(member)}</Text>
            </LinearGradient>
          ) : null}
        </View>
      </Pressable>

      {justCompleted ? (
        <View style={styles.celebrate}>
          <Text style={styles.celebrateBolt}>⚡</Text>
          <Text style={[styles.celebrateXp, { color: accentPrimary }]}>+{task.xp}</Text>
        </View>
      ) : (
        <XPBadge xp={task.xp} done={done} accent={accentPrimary} />
      )}
    </View>
  );
}

/** Preferred household order for admin by-person breakdown (after “My tasks”). */
const MEMBER_SECTION_ORDER = ['Sarah', 'David', 'Liam', 'Emma'];

function sortTasksForMember(tasks: HouseholdTask[]) {
  const rank = (task: HouseholdTask) => {
    if (task.status === 'Completed') return 3;
    if (isDueToday(task)) return 0;
    if (task.status === 'Overdue') return 0;
    return 1;
  };
  return [...tasks].sort((a, b) => rank(a) - rank(b));
}

function TaskSection({
  title,
  dotColor,
  dotGlow,
  countLabel,
  tasks,
  members,
  rooms,
  accentPrimary,
  muted,
  allowEmpty,
  emptyLabel,
  progress,
  justCompletedId,
  onToggle,
}: {
  title: string;
  dotColor: string;
  dotGlow?: boolean;
  countLabel: string;
  tasks: HouseholdTask[];
  members: HouseholdMember[];
  rooms: HouseholdRoom[];
  accentPrimary: string;
  muted?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  progress?: { done: number; total: number; color: string };
  justCompletedId: string | null;
  onToggle: (taskId: string) => void;
}) {
  if (tasks.length === 0 && !allowEmpty) return null;

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : progress ? 0 : null;

  return (
    <GlassCard style={[muted && styles.completedCard]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View
            style={[
              styles.sectionDot,
              { backgroundColor: dotColor },
              dotGlow && { shadowColor: dotColor, shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
            ]}
          />
          <Text style={[styles.sectionTitle, muted && styles.sectionTitleMuted]}>{title}</Text>
        </View>
        <Text style={styles.sectionCount}>{countLabel}</Text>
      </View>
      {progress && progressPct !== null ? (
        <View style={styles.memberProgressTrack}>
          <View
            style={[
              styles.memberProgressFill,
              { width: `${progressPct}%`, backgroundColor: progress.color },
            ]}
          />
        </View>
      ) : null}
      {tasks.length === 0 ? (
        <Text style={styles.memberEmpty}>{emptyLabel ?? 'No tasks assigned'}</Text>
      ) : (
        tasks.map((task, index) => (
          <View key={task.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <TaskItem
              task={task}
              member={getMember(members, task.assignee)}
              room={rooms.find((item) => item.id === task.roomId)}
              accentPrimary={accentPrimary}
              justCompleted={justCompletedId === task.id}
              onToggle={() => onToggle(task.id)}
            />
          </View>
        ))
      )}
    </GlassCard>
  );
}

export default function TasksScreen() {
  const { accentTheme, completeTask, currentMember, household, permissions, splitAllTasksBetweenTwo } =
    useOrbit();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [showRoomFilter, setShowRoomFilter] = useState(false);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);

  const rooms = household.rooms ?? [];
  const childNames = useMemo(
    () => new Set(household.members.filter((member) => member.role === 'child').map((member) => member.name)),
    [household.members]
  );
  const splitPair = useMemo(() => resolveSplitPair(household.members), [household.members]);
  const adminNames = useMemo(
    () => new Set(getAdminMembers(household.members).map((member) => member.name)),
    [household.members]
  );

  const sharedMineNames = useMemo(
    () => sharedDeviceAssigneeNames(currentMember, household.members),
    [currentMember, household.members]
  );

  const filtered = useMemo(() => {
    return household.tasks.filter((task) => {
      if (filter === 'mine') {
        if (isSharedDeviceMember(currentMember)) {
          const onShared =
            [...sharedMineNames].some((name) => taskMatchesAssignee(task, name)) ||
            task.sharedDeviceId === currentMember?.id;
          if (!onShared) return false;
        } else if (!taskMatchesAssignee(task, currentMember?.name)) {
          return false;
        }
      }
      if (filter === 'split') {
        if (!splitPair) return false;
        return (
          taskMatchesAssignee(task, splitPair[0].name) || taskMatchesAssignee(task, splitPair[1].name)
        );
      }
      if (filter === 'kids' && ![...childNames].some((name) => taskMatchesAssignee(task, name))) {
        return false;
      }
      if (filter === 'homework' && !isHomework(task)) return false;
      if (roomFilter && task.roomId !== roomFilter) return false;
      return true;
    });
  }, [
    childNames,
    currentMember,
    filter,
    household.tasks,
    roomFilter,
    sharedMineNames,
    splitPair,
  ]);

  const grouped = useMemo(
    () => ({
      today: filtered.filter(isDueToday),
      upcoming: filtered.filter(isUpcoming),
      done: filtered.filter((task) => task.status === 'Completed'),
    }),
    [filtered]
  );

  const splitSections = useMemo(() => {
    if (!splitPair || filter !== 'split') return null;
    return [
      {
        member: splitPair[0],
        tasks: filtered.filter(
          (task) => taskMatchesAssignee(task, splitPair[0].name) && task.status !== 'Completed'
        ),
      },
      {
        member: splitPair[1],
        tasks: filtered.filter(
          (task) => taskMatchesAssignee(task, splitPair[1].name) && task.status !== 'Completed'
        ),
      },
    ];
  }, [filter, filtered, splitPair]);

  /** Admins see All broken down by person (completion visible per member). */
  const showByMember = permissions.canManageHousehold && filter === 'all';

  const memberSections = useMemo(() => {
    if (!showByMember) return null;

    const activeMembers = household.members.filter(
      (member) =>
        member.status === 'active' &&
        member.role !== 'guest' &&
        !isSharedDeviceRole(member.role)
    );

    const ordered = [...activeMembers].sort((a, b) => {
      if (currentMember && a.id === currentMember.id) return -1;
      if (currentMember && b.id === currentMember.id) return 1;
      const ai = MEMBER_SECTION_ORDER.indexOf(a.name);
      const bi = MEMBER_SECTION_ORDER.indexOf(b.name);
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return ordered.map((member) => {
      const tasks = sortTasksForMember(
        filtered.filter((task) => taskMatchesAssignee(task, member.name) && task.status !== 'Cancelled')
      );
      const done = tasks.filter((task) => task.status === 'Completed').length;
      const total = tasks.length;
      const isMine = currentMember?.id === member.id;
      return {
        member,
        tasks,
        done,
        total,
        title: isMine ? `My tasks (${member.name})` : `${member.name}'s tasks`,
        accent: MEMBER_ACCENTS[member.name]?.color ?? accentTheme.primary,
      };
    });
  }, [accentTheme.primary, currentMember, filtered, household.members, showByMember]);

  const totalXPToday = grouped.today.reduce((sum, task) => sum + task.xp, 0);
  const empty = showByMember
    ? (memberSections?.every((section) => section.total === 0) ?? true)
    : grouped.today.length + grouped.upcoming.length + grouped.done.length === 0;
  const canSplit =
    permissions.canAssignTask && Boolean(splitPair) && (permissions.canManageHousehold || adminNames.has(currentMember?.name ?? ''));

  const handleToggle = async (taskId: string) => {
    const task = household.tasks.find((item) => item.id === taskId);
    if (!task || task.status === 'Completed' || task.status === 'Cancelled') return;

    if (isSplitTask(task)) {
      if (!currentMember || !taskMatchesAssignee(task, currentMember.name)) return;
      const share = task.shares?.find((item) => item.name === currentMember.name);
      if (!share || share.status !== 'Pending') return;
      if (
        task.proofRequired &&
        share.proofStatus !== 'submitted' &&
        share.proofStatus !== 'approved'
      ) {
        router.push(`/task/${task.id}` as never);
        return;
      }
      setJustCompletedId(taskId);
      await completeTask(taskId, { forAssignee: currentMember.name });
      setTimeout(() => setJustCompletedId(null), 1200);
      return;
    }

    setJustCompletedId(taskId);
    await completeTask(taskId);
    setTimeout(() => setJustCompletedId(null), 1200);
  };

  const handleSplit = () => {
    if (!splitPair) {
      Alert.alert('Need two people', 'Add a co-admin (or another active member) to split tasks.');
      return;
    }
    Alert.alert(
      'Split open tasks',
      `Reassign every open task evenly between ${splitPair[0].name} and ${splitPair[1].name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Split now',
          onPress: () => {
            setSplitting(true);
            void splitAllTasksBetweenTwo(splitPair[0].name, splitPair[1].name).finally(() =>
              setSplitting(false)
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.headerRow}>
        <View style={orbitScreen.header}>
          <ChoremaxxBadge />
          <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Tasks & Homework</Text>
          <Text style={orbitTypography.display}>
            {showByMember ? 'Household tasks' : "Today's Work"}
          </Text>
        </View>
        {permissions.canCreateTask ? (
          <Pressable onPress={() => router.push('/create-task' as never)} style={styles.addButtonWrap}>
            <LinearGradient
              colors={[accentTheme.primary, accentTheme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButton}>
              <MaterialIcons name="add" size={20} color={orbitColors.ink} />
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>

      <LinearGradient
        colors={[`${accentTheme.primary}1F`, 'rgba(52,211,153,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.xpBanner, { borderColor: `${accentTheme.primary}26` }]}>
        <View style={styles.xpBannerLeft}>
          <MaterialIcons name="local-fire-department" size={16} color={orbitColors.warning} />
          <Text style={styles.xpBannerTitle}>{totalXPToday} XP available today</Text>
        </View>
        <Text style={styles.xpBannerMeta}>{grouped.today.length} tasks left</Text>
      </LinearGradient>

      {canSplit ? (
        <Pressable
          onPress={handleSplit}
          disabled={splitting}
          style={[styles.splitBanner, { borderColor: `${accentTheme.primary}33` }]}>
          <MaterialIcons name="call-split" size={16} color={accentTheme.primary} />
          <Text style={[styles.splitBannerText, { color: accentTheme.primary }]}>
            {splitting
              ? 'Splitting…'
              : splitPair
                ? `Split open tasks · ${splitPair[0].name} & ${splitPair[1].name}`
                : 'Split open tasks'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setFilter(tab.id)}
              style={[
                styles.filterChip,
                active && {
                  backgroundColor: `${accentTheme.primary}2E`,
                  borderColor: `${accentTheme.primary}4D`,
                },
              ]}>
              <Text style={[styles.filterChipText, active && { color: accentTheme.primary, fontWeight: '600' }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[
            styles.filterIconButton,
            (showRoomFilter || roomFilter) && {
              backgroundColor: `${accentTheme.primary}2E`,
              borderColor: `${accentTheme.primary}4D`,
            },
          ]}
          onPress={() => setShowRoomFilter((value) => !value)}>
          <MaterialIcons
            name="filter-list"
            size={14}
            color={showRoomFilter || roomFilter ? accentTheme.primary : orbitColors.textSubtle}
          />
        </Pressable>
      </View>

      {showRoomFilter ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomFilterRow}>
          <Pressable
            onPress={() => setRoomFilter(null)}
            style={[
              styles.roomChip,
              !roomFilter && {
                backgroundColor: `${accentTheme.primary}22`,
                borderColor: `${accentTheme.primary}44`,
              },
            ]}>
            <Text style={[styles.roomChipText, !roomFilter && { color: accentTheme.primary }]}>All rooms</Text>
          </Pressable>
          {rooms.map((room) => {
            const active = roomFilter === room.id;
            return (
              <Pressable
                key={room.id}
                onPress={() => setRoomFilter(room.id)}
                style={[
                  styles.roomChip,
                  active && {
                    backgroundColor: `${accentTheme.primary}22`,
                    borderColor: `${accentTheme.primary}44`,
                  },
                ]}>
                <Text style={[styles.roomChipText, active && { color: accentTheme.primary }]}>
                  {room.emoji} {room.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {empty ? (
        <GlassCard>
          <Text style={styles.emptyTitle}>Nothing in this view</Text>
          <Text style={styles.emptyBody}>
            {permissions.canCreateTask
              ? "Create a preset or custom task to fill Today's Work."
              : 'Ask an adult to assign you something, or switch filters.'}
          </Text>
          {permissions.canCreateTask ? (
            <Pressable onPress={() => router.push('/create-task' as never)} style={styles.emptyCta}>
              <Text style={[styles.emptyCtaText, { color: accentTheme.primary }]}>Create task</Text>
            </Pressable>
          ) : null}
        </GlassCard>
      ) : null}

      {splitSections ? (
        <>
          {splitSections.map((section) => (
            <TaskSection
              key={section.member.id}
              title={section.member.name}
              dotColor={MEMBER_ACCENTS[section.member.name]?.color ?? accentTheme.primary}
              countLabel={`${section.tasks.length} open`}
              tasks={section.tasks}
              members={household.members}
              rooms={rooms}
              accentPrimary={accentTheme.primary}
              justCompletedId={justCompletedId}
              onToggle={handleToggle}
            />
          ))}
          <TaskSection
            title="Completed"
            dotColor={orbitColors.success}
            countLabel={`+${grouped.done.reduce((sum, task) => sum + task.xp, 0)} XP earned`}
            tasks={grouped.done}
            members={household.members}
            rooms={rooms}
            accentPrimary={accentTheme.primary}
            muted
            justCompletedId={justCompletedId}
            onToggle={handleToggle}
          />
        </>
      ) : memberSections ? (
        memberSections.map((section) => (
          <TaskSection
            key={section.member.id}
            title={section.title}
            dotColor={section.accent}
            countLabel={
              section.total === 0 ? 'No tasks' : `${section.done} of ${section.total} complete`
            }
            tasks={section.tasks}
            members={household.members}
            rooms={rooms}
            accentPrimary={accentTheme.primary}
            allowEmpty
            emptyLabel="No tasks assigned"
            progress={{ done: section.done, total: section.total, color: section.accent }}
            muted={section.total > 0 && section.done === section.total}
            justCompletedId={justCompletedId}
            onToggle={handleToggle}
          />
        ))
      ) : (
        <>
          <TaskSection
            title="Due Today"
            dotColor={orbitColors.warning}
            dotGlow
            countLabel={`${grouped.today.length} items`}
            tasks={grouped.today}
            members={household.members}
            rooms={rooms}
            accentPrimary={accentTheme.primary}
            justCompletedId={justCompletedId}
            onToggle={handleToggle}
          />

          <TaskSection
            title="Upcoming"
            dotColor={accentTheme.primary}
            countLabel={`${grouped.upcoming.length} items`}
            tasks={grouped.upcoming}
            members={household.members}
            rooms={rooms}
            accentPrimary={accentTheme.primary}
            justCompletedId={justCompletedId}
            onToggle={handleToggle}
          />

          <TaskSection
            title="Completed"
            dotColor={orbitColors.success}
            countLabel={`+${grouped.done.reduce((sum, task) => sum + task.xp, 0)} XP earned`}
            tasks={grouped.done}
            members={household.members}
            rooms={rooms}
            accentPrimary={accentTheme.primary}
            muted
            justCompletedId={justCompletedId}
            onToggle={handleToggle}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: orbitRadius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  addButtonWrap: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  assigneeDot: {
    alignItems: 'center',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  assigneeEmoji: {
    fontSize: 9,
  },
  celebrate: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  celebrateBolt: {
    fontSize: 16,
  },
  celebrateXp: {
    fontSize: 14,
    fontWeight: '800',
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginTop: 2,
    width: 24,
  },
  completedCard: {
    backgroundColor: orbitColors.cardMuted,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: 1,
  },
  dueText: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  emptyBody: {
    color: orbitColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyCta: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTitle: {
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  memberEmpty: {
    color: orbitColors.textSubtle,
    fontSize: 13,
    paddingVertical: 4,
  },
  memberProgressFill: {
    borderRadius: 999,
    height: '100%',
  },
  memberProgressTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 4,
    marginBottom: 10,
    overflow: 'hidden',
    width: '100%',
  },
  filterChip: {
    backgroundColor: orbitColors.card,
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '400',
  },
  filterIconButton: {
    alignItems: 'center',
    backgroundColor: orbitColors.card,
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 32,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  metaPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaPillText: {
    color: orbitColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  roomChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roomChipText: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
  roomFilterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  sectionCount: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  sectionDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitleMuted: {
    color: orbitColors.textMuted,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  subjectPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  subjectPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  taskItemDone: {
    opacity: 0.45,
  },
  taskTitle: {
    color: orbitColors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  taskTitleDone: {
    color: orbitColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  xpBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpBadgeDone: {
    backgroundColor: 'rgba(75,96,128,0.2)',
    opacity: 0.5,
  },
  xpBadgeText: {
    color: orbitColors.orbitBlue,
    fontSize: 12,
    fontWeight: '700',
  },
  xpBadgeTextDone: {
    color: orbitColors.textSubtle,
  },
  xpBanner: {
    alignItems: 'center',
    borderColor: 'rgba(56,189,248,0.15)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: 12,
  },
  xpBannerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  xpBannerMeta: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  xpBannerTitle: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  splitBanner: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  splitBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  xpBolt: {
    fontSize: 10,
  },
});
