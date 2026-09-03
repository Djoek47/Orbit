import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ContextMenu } from '@/components/orbit/context-menu';
import { EmptyState } from '@/components/orbit/empty-state';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RefreshIconButton } from '@/components/orbit/refresh-icon-button';
import { PersonaSwitchPopup } from '@/components/orbit/persona-switch-popup';
import { SearchBar } from '@/components/orbit/search-bar';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { StreakMarker } from '@/components/orbit/streak-marker';
import { VOCAB } from '@/constants/vocabulary';
import { orbitColors, orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { motion, motionDuration } from '@/constants/motion-tokens';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { isTasksStatus } from '@/lib/navigation/open-tasks-tab';
import { useHouseholdRefresh } from '@/lib/refresh/use-household-refresh';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import {
  normalizeRewardSettings,
  resolveTaskXpFromHouseholdTask,
  type HouseholdRewardSettings,
} from '@/lib/rewards/reward-mode';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { householdHasChildren } from '@/lib/household/has-children';
import {
  findSharedDeviceForMember,
  isSharedDeviceAccount,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { isSplitTask, taskMatchesAssignee } from '@/lib/tasks/split-assign';
import { isDueToday } from '@/lib/tasks/today';
import { displayDueLabel, homeworkDueChip } from '@/lib/tasks/due-label';
import {
  groupExpiredByDay,
  isActiveTask,
  isCompletedTask,
  isExpiredTask,
  isExpiredVisibleInTab,
} from '@/lib/tasks/expired-tab';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import { homeworkSubjectMeta, resolveHomeworkSubject } from '@/lib/tasks/homework-subject';
import { useTasksLiveRefresh } from '@/lib/refresh/use-tasks-live-refresh';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type TaskFilter = 'all' | 'mine';

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

type TaskDomainTab = 'chores' | 'homework';
type TaskStatusTab = 'active' | 'completed' | 'expired';

const FILTER_TABS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
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
  return (
    task.category === 'homework_education' ||
    /homework/i.test(task.category) ||
    /homework/i.test(task.title)
  );
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
  return homeworkSubjectMeta(resolveHomeworkSubject(task));
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

function XPBadge({
  xp,
  done,
  accent,
  hygiene,
  hygieneXpWhenRewarded,
}: {
  xp: number;
  done: boolean;
  accent: string;
  hygiene?: boolean;
  hygieneXpWhenRewarded?: number;
}) {
  const { c, glass } = useOrbitColors();
  if (hygiene) {
    return (
      <View
        style={[
          styles.xpBadge,
          done && { backgroundColor: glass(0.1), opacity: 0.55 },
          !done && { backgroundColor: glass(0.08) },
        ]}>
        <StreakMarker variant="asterisk" xpWhenRewarded={hygieneXpWhenRewarded} />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.xpBadge,
        done && { backgroundColor: glass(0.1), opacity: 0.55 },
        !done && { backgroundColor: `${accent}1F` },
      ]}>
      <Text style={styles.xpBolt}>⚡</Text>
      <Text style={[styles.xpBadgeText, { color: done ? c.textSubtle : accent }]}>+{xp}</Text>
    </View>
  );
}

function TaskItem({
  task,
  member,
  accentPrimary,
  justCompleted,
  canDelete,
  hygieneXpWhenRewarded,
  rewardSettings,
  xpEnabled,
  interactive = true,
  homeworkCard = false,
  onToggle,
  onDelete,
}: {
  task: HouseholdTask;
  member?: HouseholdMember;
  accentPrimary: string;
  justCompleted: boolean;
  canDelete: boolean;
  hygieneXpWhenRewarded?: number;
  rewardSettings: HouseholdRewardSettings;
  xpEnabled: boolean;
  interactive?: boolean;
  homeworkCard?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { cancelTask } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const shareDone =
    member && isSplitTask(task)
      ? task.shares?.find((share) => share.name === member.name)?.status === 'Completed'
      : undefined;
  const done = shareDone ?? task.status === 'Completed';
  const checkScale = useSharedValue(done ? 1 : 0.001);
  const pillScale = useSharedValue(1);
  const wash = useSharedValue(done && !justCompleted ? 0.4 : 0);

  useEffect(() => {
    checkScale.value = withSpring(done ? 1 : 0.001, motion.snappy);
  }, [checkScale, done]);

  useEffect(() => {
    if (!justCompleted) {
      wash.value = withTiming(done ? 0.35 : 0, { duration: motionDuration.snappy });
      return;
    }
    wash.value = 0;
    wash.value = withTiming(1, {
      duration: motionDuration.smooth,
      easing: Easing.out(Easing.cubic),
    });
    pillScale.value = 0.97;
    pillScale.value = withSpring(1, motion.smooth);
  }, [done, justCompleted, pillScale, wash]);

  const checkAnim = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const pillAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));
  const washAnim = useAnimatedStyle(() => ({
    opacity: interpolate(wash.value, [0, 1], [0, 0.32]),
  }));
  const shareXp =
    member && isSplitTask(task)
      ? task.shares?.find((share) => share.name === member.name)?.awardedXp
      : undefined;
  const displayXp =
    shareXp ?? task.awardedXp ?? resolveTaskXpFromHouseholdTask(task, rewardSettings);
  const sub = getSubjectMeta(task);
  const accent = memberAccentColor(member);
  const homeworkOpen = homeworkCard && isHomework(task) && !done && interactive;
  const dueChip = homeworkCard && isHomework(task) ? homeworkDueChip(task) : null;
  const borderColor = done
    ? accent
    : `${isHomework(task) ? (sub?.color ?? c.planPurple) : getPriorityColor(task)}80`;
  const avatarGradient = GRADIENT_BY_COLOR[accent] ?? [accent, accent];
  const hygiene = task.tracking === 'streak' || task.category === 'Hygiene';
  const metaPillTone = {
    backgroundColor: glass(0.08),
    borderColor: glassBorder(0.12),
  } as const;

  const row = (
      <Animated.View
        style={[
          styles.taskItem,
          done && !justCompleted && styles.taskItemDone,
          done && { backgroundColor: glass(justCompleted ? 0.1 : 0.03) },
          pillAnim,
        ]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: '#34D399', borderRadius: 16 },
            washAnim,
          ]}
        />
        {interactive && !isExpiredStatus(task.status) ? (
        <Pressable
          onPress={onToggle}
          style={[
            styles.checkbox,
            {
              borderColor,
              backgroundColor: done ? accent : 'transparent',
            },
          ]}>
          <Animated.View style={checkAnim}>
            {done ? <MaterialIcons name="check" size={12} color={c.ink} /> : null}
          </Animated.View>
        </Pressable>
        ) : (
          <View style={[styles.checkbox, { borderColor: `${c.warning}66`, opacity: 0.5 }]} />
        )}

        <View style={styles.taskBody}>
        <View style={styles.titleRow}>
          {isHomework(task) && sub ? (
            <View style={[styles.subjectPill, homeworkCard && styles.subjectPillLarge, { backgroundColor: `${sub.color}18` }]}>
              <Text style={[styles.subjectPillText, homeworkCard && styles.subjectPillTextLarge, { color: sub.color }]}>
                {sub.emoji} {sub.label}
              </Text>
            </View>
          ) : null}
          <Text
            style={[
              styles.taskTitle,
              homeworkCard && styles.homeworkTitle,
              { color: done && !justCompleted ? c.textMuted : c.text },
              done && !justCompleted && styles.taskTitleDone,
            ]}
            numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {dueChip ? (
            <View
              style={[
                styles.metaPill,
                styles.homeworkDuePill,
                { backgroundColor: `${sub?.color ?? c.planPurple}22`, borderColor: `${sub?.color ?? c.planPurple}44` },
              ]}>
              <MaterialIcons name="schedule" size={12} color={sub?.color ?? c.planPurple} />
              <Text style={[styles.metaPillText, { color: sub?.color ?? c.planPurple, fontWeight: '700' }]}>
                {dueChip}
              </Text>
            </View>
          ) : (
            <>
          <MaterialIcons name="schedule" size={10} color={c.textSubtle} />
          <Text style={[styles.dueText, { color: c.textSubtle }]}>{displayDueLabel(task)}</Text>
            </>
          )}
          {task.completedLate || (done && task.completedAt && task.dueAt && task.completedAt > task.dueAt) ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: `${c.warning}22`, borderColor: `${c.warning}40` },
              ]}>
              <Text style={[styles.metaPillText, { color: c.warning }]}>
                {VOCAB.lateCredit}
                {typeof task.awardedXp === 'number' ? ` +${task.awardedXp}` : ''}
                {typeof task.baseXp === 'number' &&
                typeof task.awardedXp === 'number' &&
                task.baseXp > task.awardedXp
                  ? ` · was ${task.baseXp}`
                  : ''}
              </Text>
            </View>
          ) : null}
          {isExpiredStatus(task.status) ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: `${c.warning}22`, borderColor: `${c.warning}40` },
              ]}>
              <Text style={[styles.metaPillText, { color: c.warning }]}>{VOCAB.expired}</Text>
            </View>
          ) : null}
          {isSplitTask(task) ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: `${c.planPurple}22`, borderColor: `${c.planPurple}40` },
              ]}>
              <Text style={[styles.metaPillText, { color: c.planPurple }]}>Split</Text>
            </View>
          ) : null}
          {task.repeat !== 'None' ? (
            <View style={[styles.metaPill, metaPillTone]}>
              <Text style={[styles.metaPillText, { color: c.textMuted }]}>{task.repeat}</Text>
            </View>
          ) : null}
          {task.proofRequired ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: `${c.warning}22`, borderColor: `${c.warning}40` },
              ]}>
              <Text style={[styles.metaPillText, { color: c.warning }]}>
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
      </View>

        {xpEnabled ? (
          justCompleted ? (
            <View style={styles.celebrate}>
              {hygiene ? (
                <StreakMarker variant="asterisk" xpWhenRewarded={hygieneXpWhenRewarded} />
              ) : (
                <>
                  <Text style={styles.celebrateBolt}>⚡</Text>
                  <Text style={[styles.celebrateXp, { color: accentPrimary }]}>+{displayXp}</Text>
                </>
              )}
            </View>
          ) : homeworkOpen ? (
            <Pressable
              onPress={onToggle}
              style={[styles.completeCta, { backgroundColor: sub?.color ?? c.planPurple }]}>
              <Text style={[styles.completeCtaText, { color: c.ink }]}>Complete</Text>
            </Pressable>
          ) : (
            <XPBadge
              xp={displayXp}
              done={done}
              accent={accentPrimary}
              hygiene={hygiene}
              hygieneXpWhenRewarded={hygieneXpWhenRewarded}
            />
          )
        ) : homeworkOpen ? (
          <Pressable
            onPress={onToggle}
            style={[styles.completeCta, { backgroundColor: sub?.color ?? c.planPurple }]}>
            <Text style={[styles.completeCtaText, { color: c.ink }]}>Complete</Text>
          </Pressable>
        ) : null}
      </Animated.View>
  );

  const expired = isExpiredStatus(task.status);
  const openTask = () => router.push(`/task/${task.id}` as never);

  return (
    <ContextMenu
      onPress={openTask}
      actions={[
        { key: 'open', label: 'Open task', icon: 'chevron-right', onPress: openTask },
        ...(!done && !expired && interactive
          ? [{ key: 'complete', label: 'Mark complete', icon: 'check' as const, onPress: onToggle }]
          : []),
        ...(!done && !expired && canDelete && task.repeat !== 'None'
          ? [
              {
                key: 'skip',
                label: 'Skip today',
                icon: 'event-busy' as const,
                onPress: () => void cancelTask(task.id, 'this'),
              },
            ]
          : []),
        ...(canDelete
          ? [
              {
                key: 'delete',
                label: 'Delete',
                icon: 'delete-outline' as const,
                destructive: true,
                onPress: () => {
                  Alert.alert('Delete task', `Remove “${task.title}”?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDelete },
                  ]);
                },
              },
            ]
          : []),
      ]}>
      {row}
    </ContextMenu>
  );
}

/** Preferred household order for admin by-person breakdown (after “My tasks”). */
const MEMBER_SECTION_ORDER = ['Sarah', 'David', 'Liam', 'Emma', 'Josh', 'Todd'];

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
  accentPrimary,
  muted,
  allowEmpty,
  emptyLabel,
  progress,
  justCompletedId,
  canDelete,
  hygieneXpWhenRewarded,
  rewardSettings,
  xpEnabled,
  interactive = true,
  homeworkCard = false,
  onToggle,
  onDelete,
}: {
  title: string;
  dotColor: string;
  dotGlow?: boolean;
  countLabel: string;
  tasks: HouseholdTask[];
  members: HouseholdMember[];
  accentPrimary: string;
  muted?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  progress?: { done: number; total: number; color: string };
  justCompletedId: string | null;
  canDelete: boolean;
  hygieneXpWhenRewarded?: number;
  rewardSettings: HouseholdRewardSettings;
  xpEnabled: boolean;
  interactive?: boolean;
  homeworkCard?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const { c, glass } = useOrbitColors();
  if (tasks.length === 0 && !allowEmpty) return null;

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : progress ? 0 : null;

  return (
    <GlassCard
      style={[
        muted && {
          backgroundColor: glass(0.03),
          borderColor: glass(0.08),
        },
      ]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View
            style={[
              styles.sectionDot,
              { backgroundColor: dotColor },
              dotGlow && { shadowColor: dotColor, shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
            ]}
          />
          <Text style={[styles.sectionTitle, { color: muted ? c.textMuted : c.text }]}>{title}</Text>
        </View>
        <Text style={[styles.sectionCount, { color: c.textSubtle }]}>{countLabel}</Text>
      </View>
      {progress && progressPct !== null ? (
        <View style={[styles.memberProgressTrack, { backgroundColor: glass(0.1) }]}>
          <View
            style={[
              styles.memberProgressFill,
              { width: `${progressPct}%`, backgroundColor: progress.color },
            ]}
          />
        </View>
      ) : null}
      {tasks.length === 0 ? (
        <Text style={[styles.memberEmpty, { color: c.textSubtle }]}>
          {emptyLabel ?? 'No tasks assigned'}
        </Text>
      ) : (
        tasks.map((task, index) => (
          <View key={task.id}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: glass(0.08) }]} /> : null}
            <TaskItem
              task={task}
              member={getMember(members, task.assignee)}
              accentPrimary={accentPrimary}
              justCompleted={justCompletedId === task.id}
              canDelete={canDelete}
              hygieneXpWhenRewarded={hygieneXpWhenRewarded}
              rewardSettings={rewardSettings}
              xpEnabled={xpEnabled}
              interactive={interactive}
              homeworkCard={homeworkCard}
              onToggle={() => onToggle(task.id)}
              onDelete={() => onDelete(task.id)}
            />
          </View>
        ))
      )}
    </GlassCard>
  );
}

export default function TasksScreen() {
  const chromePad = useTabChromePaddingTop();
  const params = useLocalSearchParams<{ member?: string | string[]; status?: string | string[] }>();
  const { c, glass, glassBorder } = useOrbitColors();
  const {
    accentTheme,
    completeTask,
    currentMember,
    deleteTask,
    household,
    orbitPalette,
    permissions,
    rewardCapabilities,
    switchPersona,
    v2Permissions,
  } = useOrbit();
  const { refreshing, onRefresh } = useHouseholdRefresh();
  useTasksLiveRefresh(true);
  const [domainTab, setDomainTab] = useState<TaskDomainTab>('chores');
  const [statusTab, setStatusTab] = useState<TaskStatusTab>('active');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [focusMember, setFocusMember] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [personaSwitchOpen, setPersonaSwitchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const rewardSettings = useMemo(
    () =>
      normalizeRewardSettings({
        rewardMode: household.rewardMode,
        hygieneRewarded: household.hygieneRewarded,
        hygieneXp: household.hygieneXp,
      }),
    [household.hygieneRewarded, household.hygieneXp, household.rewardMode]
  );
  const hygieneXpWhenRewarded = rewardSettings.hygieneRewarded
    ? rewardSettings.hygieneXp
    : undefined;

  const assignRoute =
    domainTab === 'homework'
      ? ('/assign-homework' as const)
      : ('/assign-task' as const);
  const memberParam = Array.isArray(params.member) ? params.member[0] : params.member;
  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;

  useEffect(() => {
    // undefined = opened via tab bar with no deep-link; leave local focus alone.
    if (memberParam === undefined) return;
    const next = memberParam.trim();
    setFocusMember(next || null);
    if (next) setFilter('all');
  }, [memberParam]);

  useFocusEffect(
    useCallback(() => {
      if (statusParam === undefined) return;
      const next = statusParam.trim();
      if (isTasksStatus(next)) setStatusTab(next);
    }, [statusParam])
  );

  const clearFocusMember = () => {
    setFocusMember(null);
    router.setParams({ member: '' } as never);
  };

  const sharedDevice = findSharedDeviceForMember(currentMember?.id, household.members);
  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const hasKids = householdHasChildren(household.members);
  const isAdmin = permissions.canManageHousehold || currentMember?.role === 'admin';

  useEffect(() => {
    if (!hasKids && domainTab === 'homework') setDomainTab('chores');
  }, [domainTab, hasKids]);

  const homeworkReview = useMemo(() => {
    if (!isAdmin || hasKids) return [];
    return household.tasks.filter(
      (task) =>
        isHomework(task) &&
        task.status !== 'Cancelled' &&
        task.status !== 'Completed'
    );
  }, [hasKids, household.tasks, isAdmin]);

  const filtered = useMemo(() => {
    return household.tasks.filter((task) => {
      if (task.status === 'Cancelled') return false;
      const homework = isHomework(task);
      if (domainTab === 'homework' ? !homework : homework) return false;
      if (statusTab === 'active' && !isActiveTask(task)) return false;
      if (statusTab === 'completed' && !isCompletedTask(task)) return false;
      if (statusTab === 'expired' && !isExpiredVisibleInTab(task)) return false;
      // Shared-tablet accounts only ever see their own tasks (switch account to see the other person).
      if (sharedKidMode) {
        if (!taskMatchesAssignee(task, currentMember?.name)) return false;
        return true;
      }
      if (focusMember && !taskMatchesAssignee(task, focusMember)) {
        return false;
      }
      if (filter === 'mine' && !taskMatchesAssignee(task, currentMember?.name)) {
        return false;
      }
      if (search.trim() && !task.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [
    currentMember?.name,
    domainTab,
    filter,
    focusMember,
    household.tasks,
    search,
    sharedKidMode,
    statusTab,
  ]);

  const grouped = useMemo(
    () => ({
      today: filtered.filter((task) => isActiveTask(task) && isDueToday(task)),
      upcoming: filtered.filter((task) => isActiveTask(task) && isUpcoming(task)),
      done: filtered.filter(isCompletedTask),
      expired: filtered.filter(isExpiredTask),
    }),
    [filtered]
  );

  const expiredGroups = useMemo(() => groupExpiredByDay(grouped.expired), [grouped.expired]);
  const expiredCount = useMemo(
    () => household.tasks.filter((t) => isExpiredVisibleInTab(t)).length,
    [household.tasks]
  );

  /** Admins see All broken down by person (completion visible per member). */
  const showByMember = !sharedKidMode && permissions.canManageHousehold && filter === 'all';

  const memberSections = useMemo(() => {
    if (!showByMember) return null;

    const activeMembers = household.members.filter(
      (member) =>
        member.status === 'active' &&
        member.role !== 'guest' &&
        !isSharedDeviceRole(member.role)
    );

    const ordered = [...activeMembers]
      .filter((member) => !focusMember || member.name === focusMember)
      .sort((a, b) => {
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
  }, [accentTheme.primary, currentMember, filtered, focusMember, household.members, showByMember]);

  const focusedMemberRecord = useMemo(
    () =>
      focusMember
        ? household.members.find((member) => member.name === focusMember) ?? null
        : null,
    [focusMember, household.members]
  );
  const focusedAccent = focusedMemberRecord
    ? MEMBER_ACCENTS[focusedMemberRecord.name]?.color ?? accentTheme.primary
    : accentTheme.primary;

  const totalXPToday = grouped.today.reduce((sum, task) => {
    if (task.tracking === 'streak' || task.category === 'Hygiene') return sum;
    return sum + resolveTaskXpFromHouseholdTask(task, rewardSettings);
  }, 0);
  const empty = showByMember
    ? (memberSections?.every((section) => section.total === 0) ?? true)
    : statusTab === 'expired'
      ? expiredGroups.length === 0
      : statusTab === 'completed'
        ? grouped.done.length === 0
        : grouped.today.length + grouped.upcoming.length === 0;
  const handleToggle = async (taskId: string) => {
    const task = household.tasks.find((item) => item.id === taskId);
    if (
      !task ||
      task.status === 'Completed' ||
      task.status === 'Cancelled' ||
      isExpiredStatus(task.status)
    ) {
      return;
    }
    if (!currentMember || !taskMatchesAssignee(task, currentMember.name)) {
      return;
    }

    try {
      if (isSplitTask(task)) {
        const share = task.shares?.find((item) => item.name === currentMember.name);
        if (!share || share.status !== 'Pending') return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setJustCompletedId(taskId);
        const result = await completeTask(taskId, { forAssignee: currentMember.name });
        setTimeout(() => setJustCompletedId(null), 900);
        if (result?.needsProof) {
          router.push(`/task/${task.id}` as never);
        } else if (!result) {
          Alert.alert('Could not complete', 'Try again or open the task for details.');
        }
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setJustCompletedId(taskId);
      const result = await completeTask(taskId);
      setTimeout(() => setJustCompletedId(null), 900);
      if (result?.needsProof) {
        router.push(`/task/${task.id}` as never);
      } else if (!result) {
        Alert.alert('Could not complete', 'Try again or open the task for details.');
      }
    } catch (error) {
      setJustCompletedId(null);
      console.warn('handleToggle', error);
      Alert.alert(
        'Could not complete',
        error instanceof Error ? error.message : 'Something went wrong. Pull to refresh and try again.'
      );
    }
  };

  const handleDelete = (taskId: string) => {
    void deleteTask(taskId);
  };

  return (
    <>
    <PersistentScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: chromePad }]}
      contentInsetAdjustmentBehavior="never"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={accentTheme.primary} />
      }>
      <View style={styles.headerRow}>
        <View style={[orbitScreen.header, styles.tasksHeader]}>
          <PageEyebrow>
            {sharedKidMode
              ? 'Your chores'
              : focusMember
                ? `${focusMember}'s chores`
                : 'Tasks & Homework'}
          </PageEyebrow>
          <Text style={[typography.title1, { color: orbitPalette.text }]}>
            {sharedKidMode
              ? 'My tasks'
              : focusMember
                ? `${focusMember}'s tasks`
                : showByMember
                  ? 'Household tasks'
                  : "Today's Work"}
          </Text>
          {sharedDevice ? (
            <Pressable
              onPress={() => {
                void import('@/lib/device/device-session').then(({ markNeedsProfilePick }) =>
                  markNeedsProfilePick().then(() => router.push('/select-profile' as never))
                );
              }}
              style={[
                styles.deviceSwitchChip,
                {
                  backgroundColor: `${accentTheme.primary}22`,
                  borderColor: `${accentTheme.primary}66`,
                },
              ]}>
              <Text style={{ fontSize: 16 }}>{sharedDevice.avatar || '📱'}</Text>
              <Text style={[styles.deviceSwitchText, { color: accentTheme.primary }]}>
                Who&apos;s on · {currentMember?.name}
              </Text>
              <MaterialIcons name="expand-more" size={18} color={accentTheme.primary} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <RefreshIconButton />
          {!sharedKidMode && (v2Permissions.canAssignOrEditTask || permissions.canCreateTask) ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: assignRoute,
                params: focusMember ? { member: focusMember } : {},
              } as never)
            }
            style={styles.addButtonWrap}>
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
      </View>

      <View style={{ gap: 10, marginBottom: 4 }}>
      {hasKids ? (
      <SegmentedControl
        options={[
          { value: 'chores', label: 'Chores' },
          { value: 'homework', label: 'Homework' },
        ]}
        value={domainTab}
        onChange={(next) => {
          clearFocusMember();
          setDomainTab(next);
        }}
      />
      ) : isAdmin && homeworkReview.length > 0 ? (
        <View style={{ paddingVertical: 8, gap: 6 }}>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            Review homework · {homeworkReview.length} open
            {(() => {
              const names = [...new Set(homeworkReview.map((t) => t.assignee))];
              return names.length ? ` · ${names.join(', ')}` : '';
            })()}
          </Text>
          {homeworkReview.slice(0, 4).map((task) => (
            <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}` as never)}>
              <Text style={[typography.footnote, { color: c.text }]}>
                {task.title} · {task.assignee}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <SegmentedControl
        options={[
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
          {
            value: 'expired',
            label: expiredCount > 0 ? `Expired · ${expiredCount}` : 'Expired',
          },
        ]}
        value={statusTab}
        onChange={(next) => {
          setStatusTab(next);
        }}
      />
      </View>

      {rewardCapabilities.xpEnabled ? (
        <LinearGradient
          colors={[`${accentTheme.primary}1F`, 'rgba(52,211,153,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.xpBanner, { borderColor: `${accentTheme.primary}26` }]}>
          <View style={styles.xpBannerLeft}>
            <MaterialIcons name="local-fire-department" size={16} color={c.warning} />
            <Text style={[styles.xpBannerTitle, { color: c.text }]}>
              {totalXPToday} XP available today
            </Text>
          </View>
          <Text style={[styles.xpBannerMeta, { color: c.textSubtle }]}>
            {grouped.today.length} tasks left
          </Text>
        </LinearGradient>
      ) : null}

      {!sharedKidMode ? (
        <>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search assigned tasks" />
          <SegmentedControl
            options={FILTER_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
            value={filter}
            onChange={(next) => {
              clearFocusMember();
              setFilter(next);
            }}
          />
        </>
      ) : null}

      {focusMember && !sharedKidMode ? (
        <Pressable
          onPress={clearFocusMember}
          style={[
            styles.focusChip,
            { backgroundColor: `${focusedAccent}22`, borderColor: `${focusedAccent}66` },
          ]}>
          <Text style={{ fontSize: 14 }}>
            {focusedMemberRecord ? memberDisplayEmoji(focusedMemberRecord) : '👤'}
          </Text>
          <Text style={[styles.focusChipText, { color: focusedAccent }]}>
            Viewing {focusMember}
          </Text>
          <MaterialIcons name="close" size={16} color={focusedAccent} />
        </Pressable>
      ) : null}

      {empty ? (
        <View>
          <EmptyState
            tone="allClear"
            title={
              statusTab === 'expired'
                ? 'Nothing expired this week.'
                : domainTab === 'homework' && sharedKidMode
                  ? "You're all clear"
                  : sharedKidMode
                    ? 'No tasks for you right now'
                    : 'Nothing in this view'
            }
            caption={
              statusTab === 'expired'
                ? `Expired tasks clear from this view after ${getHouseRulesDoc().constants.expiredPurgeDays} days.`
                : domainTab === 'homework' && sharedKidMode
                  ? 'Nothing due right now. Nice work.'
                  : sharedKidMode
                    ? 'Ask an adult to assign you something — or switch account if it’s someone else’s turn.'
                    : permissions.canCreateTask
                      ? domainTab === 'homework'
                        ? 'Assign homework so Sidekicks know what to finish.'
                        : 'Assign tasks to fill today’s work.'
                      : 'Ask an adult to assign you something, or switch filters.'
            }
          />
          {sharedKidMode ? (
            <Pressable onPress={() => setPersonaSwitchOpen(true)} style={styles.emptyCta}>
              <Text style={[styles.emptyCtaText, { color: accentTheme.primary }]}>Switch account</Text>
            </Pressable>
          ) : permissions.canCreateTask ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: assignRoute,
                  params: focusMember ? { member: focusMember } : {},
                } as never)
              }
              style={styles.emptyCta}>
              <Text style={[styles.emptyCtaText, { color: accentTheme.primary }]}>
                {domainTab === 'homework' ? 'Assign homework' : 'Assign tasks'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {statusTab === 'expired' ? (
        expiredGroups.length === 0 ? null : (
          expiredGroups.map((group) => (
            <TaskSection
              key={group.dayKey}
              title={group.label}
              dotColor={orbitColors.warning}
              countLabel={`${group.tasks.length} items`}
              tasks={group.tasks}
              members={household.members}
              accentPrimary={accentTheme.primary}
              muted
              interactive
              justCompletedId={null}
              canDelete={isAdmin}
              hygieneXpWhenRewarded={hygieneXpWhenRewarded}
              rewardSettings={rewardSettings}
              xpEnabled={rewardCapabilities.xpEnabled}
              onToggle={() => undefined}
              onDelete={handleDelete}
            />
          ))
        )
      ) : memberSections && statusTab === 'active' ? (
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
            accentPrimary={accentTheme.primary}
            allowEmpty
            emptyLabel="No tasks assigned"
            progress={{ done: section.done, total: section.total, color: section.accent }}
            muted={section.total > 0 && section.done === section.total}
            justCompletedId={justCompletedId}
            canDelete={permissions.canCreateTask}
            hygieneXpWhenRewarded={hygieneXpWhenRewarded}
            rewardSettings={rewardSettings}
            xpEnabled={rewardCapabilities.xpEnabled}
            homeworkCard={domainTab === 'homework'}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))
      ) : statusTab === 'completed' ? (
        <TaskSection
          title="Completed"
          dotColor={orbitColors.success}
          countLabel={
            rewardCapabilities.xpEnabled
              ? `+${grouped.done.reduce((sum, task) => sum + (task.awardedXp ?? resolveTaskXpFromHouseholdTask(task, rewardSettings)), 0)} XP earned`
              : `${grouped.done.length} done`
          }
          tasks={grouped.done}
          members={household.members}
          accentPrimary={accentTheme.primary}
          muted
          justCompletedId={justCompletedId}
          canDelete={permissions.canCreateTask}
          hygieneXpWhenRewarded={hygieneXpWhenRewarded}
          rewardSettings={rewardSettings}
          xpEnabled={rewardCapabilities.xpEnabled}
          homeworkCard={domainTab === 'homework'}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ) : (
        <>
          <TaskSection
            title="Due Today"
            dotColor={orbitColors.warning}
            dotGlow
            countLabel={`${grouped.today.length} items`}
            tasks={grouped.today}
            members={household.members}
            accentPrimary={accentTheme.primary}
            justCompletedId={justCompletedId}
            canDelete={permissions.canCreateTask}
            hygieneXpWhenRewarded={hygieneXpWhenRewarded}
            rewardSettings={rewardSettings}
            xpEnabled={rewardCapabilities.xpEnabled}
            homeworkCard={domainTab === 'homework'}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />

          <TaskSection
            title="Upcoming"
            dotColor={accentTheme.primary}
            countLabel={`${grouped.upcoming.length} items`}
            tasks={grouped.upcoming}
            members={household.members}
            accentPrimary={accentTheme.primary}
            justCompletedId={justCompletedId}
            canDelete={permissions.canCreateTask}
            hygieneXpWhenRewarded={hygieneXpWhenRewarded}
            rewardSettings={rewardSettings}
            xpEnabled={rewardCapabilities.xpEnabled}
            homeworkCard={domainTab === 'homework'}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        </>
      )}
    </PersistentScrollView>

    <PersonaSwitchPopup
      visible={personaSwitchOpen}
      onClose={() => setPersonaSwitchOpen(false)}
      members={household.members}
      currentMemberId={currentMember?.id ?? ''}
      onSwitch={switchPersona}
    />
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: radius.control,
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
  deviceSwitchChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deviceSwitchText: {
    fontSize: 12,
    fontWeight: '700',
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
  divider: {
    height: 1,
  },
  dueText: {
    fontSize: 12,
  },
  emptyBody: {
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
    fontSize: 15,
    fontWeight: '700',
  },
  memberEmpty: {
    fontSize: 13,
    paddingVertical: 4,
  },
  memberProgressFill: {
    borderRadius: 999,
    height: '100%',
  },
  memberProgressTrack: {
    borderRadius: 999,
    height: 4,
    marginBottom: 10,
    overflow: 'hidden',
    width: '100%',
  },
  filterChip: {
    backgroundColor: orbitColors.card,
    borderColor: orbitColors.border,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '400',
  },
  focusChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  focusChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tasksHeader: {
    flex: 1,
    gap: 6,
    paddingTop: 0,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaPillText: {
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
  sectionCount: {
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
    fontSize: 14,
    fontWeight: '600',
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
  subjectPillLarge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subjectPillTextLarge: {
    fontSize: 12,
  },
  homeworkTitle: {
    flexBasis: '100%',
    fontSize: 18,
    fontWeight: '700',
  },
  homeworkDuePill: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completeCta: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completeCtaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskItem: {
    alignItems: 'flex-start',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 12,
    position: 'relative',
  },
  taskItemDone: {
    opacity: 0.45,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  taskTitleDone: {
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
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  xpBanner: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  xpBannerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  xpBannerMeta: {
    fontSize: 12,
  },
  xpBannerTitle: {
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
