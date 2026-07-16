import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import {
  orbitColors,
  orbitRadius,
  orbitScreen,
  orbitSpacing,
  orbitTypography,
} from '@/constants/orbit-theme';
import { MEMBER_ACCENTS } from '@/lib/game-levels';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

type TaskFilter = 'all' | 'mine' | 'kids' | 'homework';

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
  { id: 'kids', label: 'Kids' },
  { id: 'homework', label: 'Homework' },
];

function isHomework(task: HouseholdTask) {
  return /homework/i.test(task.category) || /homework/i.test(task.title);
}

function isDueToday(task: HouseholdTask) {
  if (task.status === 'Completed') return false;
  return /today/i.test(task.due) || task.status === 'Overdue';
}

function isUpcoming(task: HouseholdTask) {
  if (task.status === 'Completed') return false;
  return !isDueToday(task);
}

function getMember(members: HouseholdMember[], assignee: string) {
  return members.find((member) => member.name === assignee);
}

function getSubjectMeta(task: HouseholdTask) {
  if (!isHomework(task)) return null;
  const key =
    Object.keys(SUBJECT_COLORS).find(
      (subject) => subject !== 'Homework' && new RegExp(subject, 'i').test(`${task.category} ${task.title}`)
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

function XPBadge({ xp, done }: { xp: number; done: boolean }) {
  return (
    <View style={[styles.xpBadge, done && styles.xpBadgeDone]}>
      <Text style={styles.xpBolt}>⚡</Text>
      <Text style={[styles.xpBadgeText, done && styles.xpBadgeTextDone]}>+{xp}</Text>
    </View>
  );
}

function TaskItem({
  task,
  member,
  justCompleted,
  onToggle,
}: {
  task: HouseholdTask;
  member?: HouseholdMember;
  justCompleted: boolean;
  onToggle: () => void;
}) {
  const done = task.status === 'Completed';
  const sub = getSubjectMeta(task);
  const accent = member ? (MEMBER_ACCENTS[member.name]?.color ?? orbitColors.success) : orbitColors.success;
  const borderColor = done
    ? accent
    : `${isHomework(task) ? (sub?.color ?? orbitColors.planPurple) : getPriorityColor(task)}80`;

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
          {member ? (
            <View
              style={[
                styles.assigneeDot,
                { backgroundColor: `${MEMBER_ACCENTS[member.name]?.color ?? orbitColors.orbitBlue}33` },
              ]}>
              <Text style={styles.assigneeInitial}>{member.avatar.slice(0, 1)}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {justCompleted ? (
        <View style={styles.celebrate}>
          <Text style={styles.celebrateBolt}>⚡</Text>
          <Text style={styles.celebrateXp}>+{task.xp}</Text>
        </View>
      ) : (
        <XPBadge xp={task.xp} done={done} />
      )}
    </View>
  );
}

function TaskSection({
  title,
  dotColor,
  dotGlow,
  countLabel,
  tasks,
  members,
  muted,
  justCompletedId,
  onToggle,
}: {
  title: string;
  dotColor: string;
  dotGlow?: boolean;
  countLabel: string;
  tasks: HouseholdTask[];
  members: HouseholdMember[];
  muted?: boolean;
  justCompletedId: string | null;
  onToggle: (taskId: string) => void;
}) {
  if (tasks.length === 0) return null;

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
      {tasks.map((task, index) => (
        <View key={task.id}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <TaskItem
            task={task}
            member={getMember(members, task.assignee)}
            justCompleted={justCompletedId === task.id}
            onToggle={() => onToggle(task.id)}
          />
        </View>
      ))}
    </GlassCard>
  );
}

export default function TasksScreen() {
  const { completeTask, currentMember, household } = useOrbit();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);

  const childNames = useMemo(
    () => new Set(household.members.filter((member) => member.role === 'child').map((member) => member.name)),
    [household.members]
  );

  const filtered = useMemo(() => {
    return household.tasks.filter((task) => {
      if (filter === 'all') return true;
      if (filter === 'mine') return task.assignee === currentMember?.name;
      if (filter === 'kids') return childNames.has(task.assignee);
      if (filter === 'homework') return isHomework(task);
      return true;
    });
  }, [childNames, currentMember?.name, filter, household.tasks]);

  const grouped = useMemo(
    () => ({
      today: filtered.filter(isDueToday),
      upcoming: filtered.filter(isUpcoming),
      done: filtered.filter((task) => task.status === 'Completed'),
    }),
    [filtered]
  );

  const totalXPToday = grouped.today.reduce((sum, task) => sum + task.xp, 0);

  const handleToggle = async (taskId: string) => {
    const task = household.tasks.find((item) => item.id === taskId);
    if (!task || task.status === 'Completed') return;

    setJustCompletedId(taskId);
    await completeTask(taskId);
    setTimeout(() => setJustCompletedId(null), 1200);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.headerRow}>
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Tasks & Homework</Text>
          <Text style={orbitTypography.display}>Today&apos;s Work</Text>
        </View>
        <Pressable onPress={() => router.push('/create-task' as never)} style={styles.addButtonWrap}>
          <LinearGradient
            colors={['#38BDF8', '#0EA5E9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addButton}>
            <MaterialIcons name="add" size={20} color={orbitColors.ink} />
          </LinearGradient>
        </Pressable>
      </View>

      <LinearGradient
        colors={['rgba(56,189,248,0.12)', 'rgba(52,211,153,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.xpBanner}>
        <View style={styles.xpBannerLeft}>
          <MaterialIcons name="local-fire-department" size={16} color={orbitColors.warning} />
          <Text style={styles.xpBannerTitle}>{totalXPToday} XP available today</Text>
        </View>
        <Text style={styles.xpBannerMeta}>{grouped.today.length} tasks left</Text>
      </LinearGradient>

      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setFilter(tab.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.filterIconButton}>
          <MaterialIcons name="filter-list" size={14} color={orbitColors.textSubtle} />
        </Pressable>
      </View>

      <TaskSection
        title="Due Today"
        dotColor={orbitColors.warning}
        dotGlow
        countLabel={`${grouped.today.length} items`}
        tasks={grouped.today}
        members={household.members}
        justCompletedId={justCompletedId}
        onToggle={handleToggle}
      />

      <TaskSection
        title="Upcoming"
        dotColor={orbitColors.orbitBlue}
        countLabel={`${grouped.upcoming.length} items`}
        tasks={grouped.upcoming}
        members={household.members}
        justCompletedId={justCompletedId}
        onToggle={handleToggle}
      />

      <TaskSection
        title="Completed"
        dotColor={orbitColors.success}
        countLabel={`+${grouped.done.reduce((sum, task) => sum + task.xp, 0)} XP earned`}
        tasks={grouped.done}
        members={household.members}
        muted
        justCompletedId={justCompletedId}
        onToggle={handleToggle}
      />
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
  assigneeInitial: {
    color: orbitColors.text,
    fontSize: 10,
    fontWeight: '700',
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
    color: orbitColors.orbitBlue,
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
  filterChip: {
    backgroundColor: orbitColors.card,
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderColor: 'rgba(56,189,248,0.3)',
  },
  filterChipText: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '400',
  },
  filterChipTextActive: {
    color: orbitColors.orbitBlue,
    fontWeight: '600',
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
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
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
  xpBolt: {
    fontSize: 10,
  },
});
