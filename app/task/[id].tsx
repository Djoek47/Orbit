import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MemberGlyph } from '@/components/orbit/member-glyph';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { XpWheel } from '@/components/orbit/xp-wheel';
import {
  TaskProofReplySheet,
  TaskProofRequestSheet,
} from '@/components/orbit/task-proof-sheets';
import Icon from '@/components/orbit/design/Icon';
import type { IconName } from '@/components/orbit/design/icons';
import { Moji } from '@/components/orbit/moji/moji';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { VOCAB } from '@/constants/vocabulary';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { canAdminRequestTaskProof, needsSidekickPhotoReply } from '@/lib/tasks/proof-eligibility';
import { typography } from '@/constants/orbit-theme';
import {
  getShare,
  isSplitTask,
  splitAllDoneBonus,
  splitPenaltyAmount,
  splitShareXp,
  taskMatchesAssignee,
} from '@/lib/tasks/split-assign';
import {
  displayTaskXp,
  isXpEligible,
  normalizeRewardSettings,
} from '@/lib/rewards/reward-mode';
import { canFinishTask, taskStateView } from '@/lib/tasks/task-state';
import { displayDueLabel } from '@/lib/tasks/due-label';
import { TASK_REPEAT_CHOICES } from '@/lib/tasks/series-edit';
import { categoryDisplayLabel } from '@/lib/tasks/task-library';
import {
  EDIT_CATEGORY_CHIPS,
  editCategoryChip,
  resolveSavedCategory,
} from '@/lib/tasks/edit-category';
import { needsProofOnComplete } from '@/lib/tasks/homework-proof';
import { isLocalProofUri } from '@/lib/tasks/proof-uri';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';


const categories = [...EDIT_CATEGORY_CHIPS];
const repeats: HouseholdTask['repeat'][] = TASK_REPEAT_CHOICES;

/** Soft chapter colours for edit chips — House Rules energy, same category icons. */
const CATEGORY_LOOK: Record<string, { color: string; icon: IconName }> = {
  Cleaning: { color: '#17B9A0', icon: 'floors' },
  Kitchen: { color: '#FF9F1C', icon: 'kitchen' },
  Laundry: { color: '#4FA3FF', icon: 'laundry' },
  Homework: { color: '#8E7CFF', icon: 'homework' },
  Groceries: { color: '#7FC24A', icon: 'groceries' },
  Pets: { color: '#FF6A3D', icon: 'pets' },
  Maintenance: { color: '#E9B44C', icon: 'maintenance' },
  General: { color: '#38BDF8', icon: 'dailyRoutine' },
};

const PROOF_COLOR = '#4FA3FF';
const DIFFICULTY_LOOK: Record<string, string> = {
  easy: '#7FC24A',
  medium: '#FF9F1C',
  hard: '#FF6A3D',
};

function repeatLabel(repeat: HouseholdTask['repeat']) {
  return repeat === 'None' ? 'Doesn’t repeat' : repeat;
}
const difficulties: NonNullable<HouseholdTask['difficulty']>[] = ['easy', 'medium', 'hard'];

function proofStatusLabel(status: HouseholdTask['proofStatus'], completed: boolean) {
  switch (status) {
    case 'submitted':
      return 'Submitted · waiting for admin';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected · attach a new photo';
    default:
      return completed
        ? 'Needed after complete · not attached yet'
        : 'Will request after you mark complete';
  }
}

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, proof: proofParam } = useLocalSearchParams<{ id: string; proof?: string | string[] }>();
  const proofIntent = Array.isArray(proofParam) ? proofParam[0] : proofParam;
  const {
    accentTheme,
    cancelTask,
    completeTask,
    confirmVerification,
    currentMember,
    deleteTask,
    household,
    markNotDone,
    orbitPalette,
    penalizeSplitAssignee,
    permissions,
    reassignTask,
    requestAnotherProof,
    sendTaskReminder,
    submitProofReply,
    submitTaskProof,
    updateTask,
    v2Permissions,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const majordomoName = useMajordomoName();
  const rewardSettings = useMemo(
    () =>
      normalizeRewardSettings({
        rewardMode: household.rewardMode,
        hygieneRewarded: household.hygieneRewarded,
        hygieneXp: household.hygieneXp,
      }),
    [household.hygieneRewarded, household.hygieneXp, household.rewardMode]
  );

  const task = household.tasks.find((item) => item.id === id);
  const taskDisplayXp = task ? displayTaskXp(task, rewardSettings) : 0;
  const memberNames = useMemo(
    () =>
      household.members
        .filter((member) => member.status === 'active' && member.role !== 'shared-device')
        .map((member) => member.name),
    [household.members]
  );

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  /** Chip label (Kitchen), not raw domain id (kitchen_dining). */
  const [category, setCategory] = useState(editCategoryChip(task?.category ?? categories[0]));
  const [due, setDue] = useState(task?.due ?? '');
  const [xp, setXp] = useState(String(task?.xp ?? 15));
  const [difficulty, setDifficulty] = useState<HouseholdTask['difficulty']>(task?.difficulty ?? 'medium');
  const [proofRequired, setProofRequired] = useState(Boolean(task?.proofRequired));
  const [busy, setBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [replySheetOpen, setReplySheetOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [celebration, setCelebration] = useState<{
    awarded: number;
    penalty: number;
    late: boolean;
    bonus?: number;
  } | null>(null);

  const canOpenProofReply =
    Boolean(task && currentMember && taskMatchesAssignee(task, currentMember.name)) &&
    task?.verification === 'proof_requested' &&
    task?.proofStatus !== 'submitted' &&
    task?.proofStatus !== 'approved';

  // Arriving to finish with a photo (Complete on a proof chore, or "I finished my math
  // homework" to Poppins): open the photo step straight away, once.
  const mine = task && currentMember && isSplitTask(task) ? getShare(task, currentMember.name) : undefined;
  const needsAttachNow =
    Boolean(task?.proofRequired && currentMember && taskMatchesAssignee(task!, currentMember.name)) &&
    (mine ? mine.status === 'Completed' : task?.status === 'Completed') &&
    (mine ? mine.proofStatus : task?.proofStatus) !== 'submitted' &&
    (mine ? mine.proofStatus : task?.proofStatus) !== 'approved';

  useEffect(() => {
    if (proofIntent === 'reply' && canOpenProofReply) setReplySheetOpen(true);
    if (proofIntent === '1' && needsAttachNow) setReplySheetOpen(true);
  }, [canOpenProofReply, needsAttachNow, proofIntent]);

  if (!task) {
    return (
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: orbitPalette.backgroundSoft,
          },
        ]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.missingTitle, { color: c.text }]}>Task not found</Text>
        <View style={{ paddingHorizontal: 20 }}>
          <DetailAction label="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const split = isSplitTask(task);
  const myShare = currentMember ? getShare(task, currentMember.name) : undefined;
  const onThisSplit = taskMatchesAssignee(task, currentMember?.name);
  const assigneeMember = household.members.find((member) => member.name === task.assignee);
  const canAskForPhoto =
    v2Permissions.canRequestProof &&
    canAdminRequestTaskProof(task, assigneeMember ?? null);
  // Match updateTask gates so Save never looks successful when the store no-ops.
  const canEdit =
    v2Permissions.canAssignOrEditTask ||
    permissions.canAssignTask ||
    permissions.canCreateTask;
  const needsProof = Boolean(task.proofRequired);
  const myProofStatus = split ? myShare?.proofStatus : task.proofStatus;
  const proofReady = myProofStatus === 'submitted' || myProofStatus === 'approved';
  // One reading of the clock. Two readings is how a task came to say "Pending · Late" and
  // "Expired · Late" at the same time.
  const stateView = taskStateView(task);
  const stateColor = {
    neutral: c.textMuted,
    live: accentTheme.primary,
    warn: c.warning,
    good: c.success,
    gone: c.textSubtle,
  }[stateView.tone];
  const memberColor = assigneeMember
    ? MEMBER_ACCENTS[assigneeMember.name]?.color ?? accentTheme.primary
    : accentTheme.primary;
  const myProofUri = split ? myShare?.proofUri : task.proofUri;
  const showProofPreview = Boolean(
    myProofUri && (myProofStatus === 'submitted' || myProofStatus === 'approved')
  );
  // EARN-04 / Rev F §12.1 — only the assignee completes (admins included cannot finish for others).
  const canCompleteMine = split
    ? Boolean(onThisSplit && myShare?.status === 'Pending')
    : Boolean(
        canFinishTask(task) && currentMember && taskMatchesAssignee(task, currentMember.name)
      );

  const canAdjust = Boolean(canEdit && task.status !== 'Cancelled');
  const isOpenWork = stateView.open;

  const handleAttachProof = async (forAssignee?: string) => {
    setReplySheetOpen(true);
    void forAssignee;
  };

  const handleComplete = async (forAssignee?: string) => {
    try {
      const result = await completeTask(task.id, forAssignee ? { forAssignee } : undefined);
      if (result) {
        setCelebration(result);
        if (result.needsProof) {
          setReplySheetOpen(true);
        }
        return;
      }
      orbitAlert('Could not complete', 'This task may already be done or not assigned to you.');
    } catch (error) {
      console.warn('handleComplete', error);
      orbitAlert(
        'Could not complete',
        error instanceof Error ? error.message : 'Something went wrong. Pull to refresh and try again.'
      );
    }
  };

  const handleConfirm = async () => {
    setProofBusy(true);
    try {
      const ok = await confirmVerification(task.id);
      if (ok) orbitAlert('Confirmed', 'Verification saved for this completion.');
    } finally {
      setProofBusy(false);
    }
  };

  const handleAskPhoto = () => {
    setRequestSheetOpen(true);
  };

  const latestAdminProofNote =
    [...(task.proofRounds ?? [])].reverse().find((round) => round.note)?.note ?? null;

  /** Sidekick must answer a proof request even though the chore is already Completed. */
  const needsSidekickProofReply =
    Boolean(currentMember && taskMatchesAssignee(task, currentMember.name)) &&
    task.verification === 'proof_requested' &&
    task.proofStatus !== 'submitted' &&
    task.proofStatus !== 'approved';

  const handleMarkNotDone = () => {
    orbitAlert('Mark not done?', 'This reverses the XP awarded for this completion.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark not done',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setProofBusy(true);
            try {
              await markNotDone(task.id);
            } catch (error) {
              const detail =
                error instanceof Error && error.message
                  ? error.message
                  : 'Try again in a moment.';
              orbitAlert('Couldn’t undo', detail);
            } finally {
              setProofBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const canSendReminder =
    isOpenWork &&
    Boolean(assigneeMember) &&
    (v2Permissions.canAssignOrEditTask || permissions.canAssignTask);

  const handleSendReminder = () => {
    if (!assigneeMember) return;
    const streak = assigneeMember.streak ?? 0;
    const streakNote =
      streak >= 2 ? ` Their ${streak}-day streak is at risk if this stays open.` : '';
    orbitAlert(
      'Send reminder?',
      `${majordomoName} will notify ${assigneeMember.name} about “${task.title}”.${streakNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            void (async () => {
              setReminderBusy(true);
              try {
                const ok = await sendTaskReminder(task.id, assigneeMember.id);
                if (ok) {
                  orbitAlert('Reminder sent', `${assigneeMember.name} was notified.`);
                }
              } finally {
                setReminderBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handlePenalize = (name: string) => {
    const dock = splitPenaltyAmount(task);
    orbitAlert(
      'Penalize for not finishing?',
      `Dock ${name} ${dock} XP for not completing their share of “${task.title}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Dock ${dock} XP`,
          style: 'destructive',
          onPress: () => {
            void penalizeSplitAssignee(task.id, name).then((amount) => {
              if (amount != null) {
                orbitAlert('Penalty applied', `${name} lost ${amount} XP.`);
              }
            });
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateTask({
        ...task,
        title: title.trim() || task.title,
        description,
        category: resolveSavedCategory(category, task.category),
        due,
        xp: Number(xp) || task.xp,
        difficulty,
        proofRequired,
      });
      setEditing(false);
    } catch {
      orbitAlert('Couldn’t save', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const syncEditFields = () => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setCategory(editCategoryChip(task.category));
    setDue(task.due);
    setXp(String(task.xp));
    setDifficulty(task.difficulty ?? 'medium');
    setProofRequired(needsProofOnComplete(task, assigneeMember ?? null));
  };

  const beginEditing = () => {
    syncEditFields();
    setEditing(true);
  };

  const cancelEditing = () => {
    syncEditFields();
    setEditing(false);
  };

  const applyRepeat = async (next: HouseholdTask['repeat']) => {
    if (next === task.repeat) {
      setRepeatOpen(false);
      return;
    }
    const write = async () => {
      setBusy(true);
      try {
        await updateTask({ ...task, repeat: next });
        setRepeatOpen(false);
      } catch {
        orbitAlert('Couldn’t save', 'Try again in a moment.');
      } finally {
        setBusy(false);
      }
    };
    if (next === 'None' && task.repeat !== 'None') {
      orbitAlert(
        'Stop repeating?',
        'Today stays on the list. Nothing new will be added after this.',
        [
          { text: 'Keep repeating', style: 'cancel' },
          { text: 'Stop', style: 'destructive', onPress: () => void write() },
        ]
      );
      return;
    }
    await write();
  };

  const applyAssignee = async (name: string) => {
    if (name === task.assignee) {
      setWhoOpen(false);
      return;
    }
    const { planTaskReassignment } = await import('@/lib/tasks/reassign-policy');
    const plan = planTaskReassignment({
      task,
      newAssigneeName: name,
      dailyDeadlineHm: household.dailyDeadline?.trim() || '19:00',
      timezone: household.timezone,
    });
    if (!plan.ok) {
      orbitAlert('Can’t reassign', plan.message);
      return;
    }
    const confirmLabel = plan.mode === 'next_day' ? `Give to ${name} tomorrow` : `Give to ${name}`;
    orbitAlert('Reassign task', plan.summary, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmLabel,
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await reassignTask(task.id, name);
              setWhoOpen(false);
            } catch (error) {
              orbitAlert(
                'Couldn’t reassign',
                error instanceof Error ? error.message : 'Try again in a moment.'
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const skipToday = async () => {
    setBusy(true);
    try {
      await cancelTask(task.id, 'this');
      router.back();
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const detail = raw.replace(/^taskRepository\.[^:]+:\s*/, '').trim() || 'Try again in a moment.';
      orbitAlert('Couldn’t skip', detail);
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    orbitAlert('Delete task', 'Remove this task from the household list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(task.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: orbitPalette.backgroundSoft }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.handle, { backgroundColor: glass(0.18) }]} />
      <View style={[styles.header, { borderBottomColor: glassBorder(0.08) }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: glass(0.06) }]} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: c.textMuted }]}>{categoryDisplayLabel(task.category)}</Text>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {editing ? 'Edit task' : 'Task'}
          </Text>
        </View>
        {canEdit && !editing ? (
          <Pressable onPress={beginEditing} style={[styles.iconBtn, { backgroundColor: glass(0.06) }]} hitSlop={8}>
            <MaterialIcons name="edit" size={16} color={accentTheme.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {!editing ? (
          <>
            <Text style={[typography.title1, { color: c.text, marginTop: 4 }]}>{task.title}</Text>
            <View style={[styles.chipRow, { marginTop: 10, marginBottom: 4 }]}>
              {/* Exactly one status chip. */}
              <View style={[styles.statusChip, { backgroundColor: `${stateColor}22` }]}>
                <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
                <Text style={[styles.statusText, { color: stateColor }]}>{stateView.label}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: `${accentTheme.primary}22` }]}>
                <Text style={[styles.statusText, { color: accentTheme.primary }]}>
                  +{taskDisplayXp} XP
                </Text>
              </View>
              {task.repeat !== 'None' ? (
                <View style={[styles.statusChip, { backgroundColor: glass(0.06) }]}>
                  <Text style={[styles.metaChipText, { color: c.textMuted }]}>{task.repeat}</Text>
                </View>
              ) : null}
              {/*
                Late Credit is not a status — it is how the XP was earned, and it only exists on
                work already done. There is no separate "Late" chip any more: a task past its
                deadline says Overdue, and once the day closes it says Expired.
              */}
              {stateView.state === 'done-late' ? (
                <View style={[styles.statusChip, { backgroundColor: 'rgba(251,146,60,0.18)' }]}>
                  <Text style={[styles.statusText, { color: c.warning }]}>
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
            </View>
          </>
        ) : null}

        {needsSidekickPhotoReply(task) && !needsSidekickProofReply ? (
          <View
            style={[
              styles.proofHero,
              { backgroundColor: `${c.warning}14`, borderColor: `${c.warning}44` },
            ]}>
            <View style={[styles.proofHeroIcon, { backgroundColor: `${c.warning}22` }]}>
              <MaterialIcons name="photo-camera" size={22} color={c.warning} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[typography.headline, { color: c.text }]}>Waiting on a photo</Text>
              <Text style={[typography.footnote, { color: c.textSoft }]}>
                {assigneeMember?.name ?? 'Your Sidekick'} has been asked for a picture. Their points stay.
              </Text>
            </View>
          </View>
        ) : null}

        {needsSidekickProofReply ? (
          <Pressable
            onPress={() => setReplySheetOpen(true)}
            style={[
              styles.proofHero,
              {
                backgroundColor: `${accentTheme.primary}18`,
                borderColor: `${accentTheme.primary}44`,
              },
            ]}>
            <View style={[styles.proofHeroIcon, { backgroundColor: `${accentTheme.primary}28` }]}>
              <MaterialIcons name="photo-camera" size={22} color={accentTheme.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[typography.headline, { color: c.text }]}>Photo needed</Text>
              <Text style={[typography.footnote, { color: c.textSoft }]}>
                {latestAdminProofNote
                  ? latestAdminProofNote
                  : 'Add a picture so it’s clear this is done.'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={c.textMuted} />
          </Pressable>
        ) : null}

        {celebration ? (
          <View style={[styles.card, styles.celebrateCard, { borderColor: glassBorder(0.08) }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Nice work</Text>
            <Text style={[styles.body, { color: c.textSoft }]}>
              +{celebration.awarded} XP
              {celebration.bonus ? ` (+${celebration.bonus} all-done bonus)` : ''}
              {celebration.late
                ? ` · ${VOCAB.lateCredit}${
                    celebration.awarded != null ? ` +${celebration.awarded}` : ''
                  }${celebration.penalty != null ? ` · was ${celebration.awarded + celebration.penalty}` : ''}`
                : ''}
              . Rankings week XP
              {celebration.late ? ' held streak' : ' and streak'} updated.
            </Text>
          </View>
        ) : null}

        {editing ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <View
              style={[
                styles.editCard,
                { borderColor: `${(CATEGORY_LOOK[category]?.color ?? accentTheme.primary)}55`, backgroundColor: glass(0.05) },
              ]}>
              <View
                style={[
                  styles.editStripe,
                  { backgroundColor: CATEGORY_LOOK[category]?.color ?? accentTheme.primary },
                ]}
              />
              <View style={styles.editHero}>
                <View
                  style={[
                    styles.editBadge,
                    {
                      backgroundColor: `${CATEGORY_LOOK[category]?.color ?? accentTheme.primary}22`,
                    },
                  ]}>
                  <Icon
                    name={CATEGORY_LOOK[category]?.icon ?? 'maintenance'}
                    size={26}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.editHeroKicker, { color: c.textMuted }]}>Editing</Text>
                  <Text style={[styles.editHeroTitle, { color: c.text }]} numberOfLines={1}>
                    {title.trim() || 'Untitled task'}
                  </Text>
                </View>
                <Moji name="clipboard" size={22} />
              </View>

              <Text style={[styles.label, { color: c.textMuted }]}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={[
                  styles.input,
                  styles.editInput,
                  { color: c.text, backgroundColor: glass(0.04), borderColor: glassBorder(0.1) },
                ]}
                placeholderTextColor={c.textSubtle}
              />
              <Text style={[styles.label, { color: c.textMuted }]}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[
                  styles.input,
                  styles.multiline,
                  styles.editInput,
                  { color: c.text, backgroundColor: glass(0.04), borderColor: glassBorder(0.1) },
                ]}
                multiline
                placeholderTextColor={c.textSubtle}
              />
              <Text style={[styles.label, { color: c.textMuted }]}>Category</Text>
              <View style={styles.chipWrap}>
                {categories.map((item) => {
                  const active = category === item;
                  const look = CATEGORY_LOOK[item] ?? { color: accentTheme.primary, icon: 'maintenance' as IconName };
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.choiceChip,
                        styles.categoryChip,
                        {
                          borderColor: active ? look.color : glassBorder(0.12),
                          backgroundColor: active ? `${look.color}22` : glass(0.03),
                        },
                      ]}>
                      <Icon name={look.icon} size={16} />
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? look.color : c.textMuted },
                        ]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.label, { color: c.textMuted }]}>Due</Text>
              <TextInput
                value={due}
                onChangeText={setDue}
                style={[
                  styles.input,
                  styles.editInput,
                  { color: c.text, backgroundColor: glass(0.04), borderColor: glassBorder(0.1) },
                ]}
                placeholderTextColor={c.textSubtle}
              />
              {!split ? (
                <>
                  <Text style={[styles.label, { color: c.textMuted }]}>Who</Text>
                  <Text style={[typography.footnote, { color: c.textSoft, marginBottom: 4 }]}>
                    After the household deadline, reassigning moves the job to tomorrow so it
                    doesn’t expire tonight and doesn’t break {task.assignee}’s streak.
                  </Text>
                  <View style={styles.chipWrap}>
                    {memberNames.map((name) => {
                      const active = task.assignee === name;
                      const member = household.members.find((item) => item.name === name);
                      return (
                        <Pressable
                          key={`edit-who-${name}`}
                          disabled={busy}
                          onPress={() => void applyAssignee(name)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Assign to ${name}`}
                          style={[
                            styles.choiceChip,
                            { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) },
                            active && {
                              borderColor: accentTheme.primary,
                              backgroundColor: `${accentTheme.primary}22`,
                            },
                          ]}>
                          <MemberGlyph member={member} size={18} />
                          <Text
                            style={[
                              styles.choiceText,
                              { color: c.textMuted },
                              active && { color: accentTheme.primary },
                            ]}>
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <Text style={[styles.label, { color: c.textMuted }]}>XP · slide the wheel</Text>
              <View
                style={[
                  styles.xpWheelCard,
                  {
                    backgroundColor: `${accentTheme.primary}12`,
                    borderColor: `${accentTheme.primary}44`,
                  },
                ]}>
                <XpWheel
                  value={Number(xp) || 15}
                  onChange={(next) => setXp(String(next))}
                  accent={accentTheme.primary}
                />
              </View>
              <Text style={[styles.label, { color: c.textMuted }]}>Difficulty</Text>
              <View style={styles.chipWrap}>
                {difficulties.map((item) => {
                  const active = difficulty === item;
                  const color = DIFFICULTY_LOOK[item] ?? accentTheme.primary;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setDifficulty(item)}
                      style={[
                        styles.choiceChip,
                        {
                          borderColor: active ? color : glassBorder(0.12),
                          backgroundColor: active ? `${color}22` : glass(0.03),
                        },
                      ]}>
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? color : c.textMuted, textTransform: 'capitalize' },
                        ]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setProofRequired((on) => !on)}
                accessibilityRole="switch"
                accessibilityState={{ checked: proofRequired }}
                accessibilityLabel="Request proof photo"
                style={[
                  styles.proofToggleCard,
                  {
                    backgroundColor: proofRequired ? `${PROOF_COLOR}18` : glass(0.04),
                    borderColor: proofRequired ? `${PROOF_COLOR}66` : glassBorder(0.1),
                  },
                ]}>
                <View style={[styles.proofToggleIcon, { backgroundColor: `${PROOF_COLOR}28` }]}>
                  <MaterialIcons name="photo-camera" size={20} color={PROOF_COLOR} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.proofToggleTitle, { color: c.text }]}>Request proof</Text>
                  <Text style={[typography.footnote, { color: c.textSoft }]}>
                    Sidekick adds a photo when they mark this done
                  </Text>
                </View>
                <Switch
                  value={proofRequired}
                  onValueChange={setProofRequired}
                  trackColor={{ false: glassBorder(0.14), true: PROOF_COLOR }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Request proof photo"
                />
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <View style={[styles.card, { borderColor: glassBorder(0.08), backgroundColor: glass(0.05) }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>{split ? 'Split between' : 'Who'}</Text>
              {canAdjust && !split ? (
                <Pressable
                  onPress={() => setWhoOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel={`Assigned to ${task.assignee}. Change who does this.`}>
                  <View style={styles.assigneeRow}>
                    {assigneeMember ? (
                      <View style={[styles.avatar, { backgroundColor: `${memberColor}33` }]}>
                        <MemberGlyph member={assigneeMember} size={18} />
                      </View>
                    ) : null}
                    <Text style={[styles.value, { color: c.text }]}>{task.assignee}</Text>
                    <MaterialIcons name={whoOpen ? 'expand-less' : 'expand-more'} size={18} color={c.textMuted} />
                  </View>
                </Pressable>
              ) : (
                <View style={styles.assigneeRow}>
                  {assigneeMember && !split ? (
                    <View style={[styles.avatar, { backgroundColor: `${memberColor}33` }]}>
                      <MemberGlyph member={assigneeMember} size={18} />
                    </View>
                  ) : null}
                  <Text style={[styles.value, { color: c.text }]}>{task.assignee}</Text>
                </View>
              )}
              {whoOpen && canAdjust && !split ? (
                <View style={styles.chipWrap}>
                  {memberNames.map((name) => {
                    const active = task.assignee === name;
                    const member = household.members.find((item) => item.name === name);
                    return (
                      <Pressable
                        key={`who-${name}`}
                        disabled={busy}
                        onPress={() => void applyAssignee(name)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Assign to ${name}`}
                        style={[
                          styles.choiceChip,
                          { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) },
                          active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` },
                        ]}>
                        <MemberGlyph member={member} size={18} />
                        <Text style={[styles.choiceText, { color: c.textMuted }, active && { color: accentTheme.primary }]}>
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {whoOpen && canAdjust && !split ? (
                <Text style={[styles.body, { color: c.textSoft }]}>
                  {stateView.state === 'overdue'
                    ? 'Past the deadline — handing off moves this job to tomorrow so it won’t expire tonight.'
                    : 'Applies from this day on. After the deadline, a handoff rolls to tomorrow.'}
                </Text>
              ) : null}
            </View>
            {/* Open work: same Who control — keep a shortcut when overdue so admins see the handoff. */}
            {isOpenWork &&
            !split &&
            stateView.state === 'overdue' &&
            (permissions.canAssignTask ||
              permissions.canManageHousehold ||
              v2Permissions.canAssignOrEditTask) ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: c.textMuted }]}>Reassign</Text>
                <Text style={[styles.body, { color: c.textSoft }]}>
                  Hand this to someone else for tomorrow. {task.assignee} will not take a miss.
                  They earn the XP when they finish.
                </Text>
                <View style={styles.chipWrap}>
                  {memberNames
                    .filter((name) => name !== task.assignee)
                    .map((name) => (
                      <Pressable
                        key={`reassign-${name}`}
                        disabled={busy}
                        onPress={() => void applyAssignee(name)}
                        style={[styles.choiceChip, { borderColor: `${accentTheme.primary}55` }]}>
                        <Text style={[styles.choiceText, { color: accentTheme.primary }]}>{name}</Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ) : null}
            {split && task.shares ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: c.textMuted }]}>Shares</Text>
                <Text style={[styles.body, { color: c.textSoft }]}>
                  Each earns {splitShareXp(task, rewardSettings)} XP · all-done bonus{' '}
                  {splitAllDoneBonus(task, rewardSettings)} XP · admin
                  penalty {splitPenaltyAmount(task)} XP
                </Text>
                {task.shares.map((share) => {
                  const person = household.members.find((member) => member.name === share.name);
                  const color = MEMBER_ACCENTS[share.name]?.color ?? accentTheme.primary;
                  return (
                    <View key={share.name} style={styles.shareRow}>
                      <View style={[styles.avatar, { backgroundColor: `${color}33` }]}>
                        <Text style={styles.avatarEmoji}>
                          <MemberGlyph member={person} size={14} />
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.value, { color: c.text }]}>{share.name}</Text>
                        <Text style={[styles.body, { color: c.textSoft }]}>
                          {share.status}
                          {needsProof
                            ? ` · ${proofStatusLabel(share.proofStatus, share.status === 'Completed')}`
                            : ''}
                          {share.awardedXp != null ? ` · +${share.awardedXp} XP` : ''}
                          {share.penalizedXp != null ? ` · −${share.penalizedXp} XP` : ''}
                        </Text>
                      </View>
                      {permissions.canManageHousehold && share.status === 'Pending' ? (
                        <Pressable onPress={() => handlePenalize(share.name)} style={styles.penalizeChip}>
                          <Text style={styles.penalizeText}>Penalize</Text>
                        </Pressable>
                      ) : null}
                      {v2Permissions.canApproveCompletion &&
                      needsProof &&
                      share.proofStatus === 'submitted' ? (
                        <Pressable
                          disabled={proofBusy}
                          onPress={() => void handleConfirm()}
                          style={styles.penalizeChip}>
                          <Text style={[styles.penalizeText, { color: accentTheme.primary }]}>
                            Confirm
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
            <DetailRow label="Due" value={displayDueLabel(task)} />
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>Repeats</Text>
              {canAdjust ? (
                <Pressable
                  onPress={() => setRepeatOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel={`Repeats ${repeatLabel(task.repeat)}. Change how often.`}>
                  <View style={styles.assigneeRow}>
                    <Text style={[styles.value, { color: c.text }]}>{repeatLabel(task.repeat)}</Text>
                    <MaterialIcons name={repeatOpen ? 'expand-less' : 'expand-more'} size={18} color={c.textMuted} />
                  </View>
                </Pressable>
              ) : (
                <Text style={[styles.value, { color: c.text }]}>{repeatLabel(task.repeat)}</Text>
              )}
              {repeatOpen && canAdjust ? (
                <View style={styles.chipWrap}>
                  {repeats.map((item) => {
                    const active = task.repeat === item;
                    return (
                      <Pressable
                        key={item}
                        disabled={busy}
                        onPress={() => void applyRepeat(item)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={repeatLabel(item)}
                        style={[
                          styles.choiceChip,
                          { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) },
                          active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` },
                        ]}>
                        <Text
                          style={[
                            styles.choiceText,
                            { color: c.textMuted },
                            active && { color: accentTheme.primary },
                          ]}>
                          {repeatLabel(item)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {repeatOpen && canAdjust ? (
                <Text style={[styles.body, { color: c.textSoft }]}>
                  Applies from this day on. Skip today to keep the schedule.
                </Text>
              ) : null}
            </View>
            <DetailRow
              label="XP"
              value={`${taskDisplayXp} XP${
                rewardSettings.rewardMode === 'weighted' && task.weight
                  ? ` · weight ${task.weight}`
                  : ''
              }${
                rewardSettings.rewardMode === 'weighted' && task.difficulty
                  ? ` · ${task.difficulty}`
                  : ''
              }${
                rewardSettings.rewardMode === 'flat' && isXpEligible(task)
                  ? ' · Equity (flat)'
                  : ''
              }`}
            />
            {needsProof && !split ? (
              <DetailRow
                label="Proof"
                value={proofStatusLabel(task.proofStatus, task.status === 'Completed')}
              />
            ) : null}
            {task.proofNote ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: c.textMuted }]}>Sidekick note</Text>
                <Text style={[typography.body, { color: c.textSoft }]}>{task.proofNote}</Text>
              </View>
            ) : null}
            {showProofPreview ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: c.textMuted }]}>Attached photo</Text>
                <ProofPhotoPreview uri={myProofUri!} />
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>Description</Text>
              <Text style={[styles.body, { color: c.textSoft }]}>{task.description || 'No additional details for this task.'}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: glassBorder(0.1),
            backgroundColor: orbitPalette.backgroundSoft,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          },
        ]}>
        <ScrollView
          style={styles.footerScroll}
          contentContainerStyle={styles.footerContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
        {editing ? (
          <View style={styles.actionStack}>
            <DetailAction
              disabled={busy || title.trim().length < 2}
              loading={busy}
              label="Save changes"
              onPress={() => void handleSave()}
            />
            <DetailAction disabled={busy} label="Cancel" onPress={cancelEditing} tone="ghost" />
          </View>
        ) : (
          <View style={styles.actionStack}>
            {task.status !== 'Completed' &&
            task.status !== 'Cancelled' &&
            canCompleteMine ? (
              <DetailAction
                label={split ? 'Mark my share complete' : 'Mark complete'}
                onPress={() => void handleComplete(split ? currentMember?.name : undefined)}
              />
            ) : null}
            {needsProof &&
            !proofReady &&
            canCompleteMine &&
            (task.status === 'Completed' || (split && myShare?.status === 'Completed')) ? (
              <TourTarget id="tasks.proof">
                <DetailAction
                  disabled={proofBusy}
                  loading={proofBusy}
                  label={
                    myProofStatus === 'rejected'
                      ? 'Re-attach proof photo'
                      : split
                        ? 'Attach my proof photo'
                        : 'Attach proof photo'
                  }
                  onPress={() => void handleAttachProof(split ? currentMember?.name : undefined)}
                />
              </TourTarget>
            ) : null}
            {needsProof &&
            myProofStatus === 'submitted' &&
            !permissions.canApproveReward &&
            canCompleteMine ? (
              <View style={[styles.waitCard, { borderColor: glassBorder(0.12), backgroundColor: glass(0.05) }]}>
                <MaterialIcons name="hourglass-top" size={18} color={c.warning} />
                <Text style={[styles.waitText, { color: c.textSoft }]}>
                  Proof sent to admin for review.
                </Text>
              </View>
            ) : null}
            {!split &&
            task.status === 'Completed' &&
            (task.verification === 'not_required' || !task.verification) &&
            (v2Permissions.canApproveCompletion || canAskForPhoto) ? (
              <>
                {canAskForPhoto ? (
                  <Pressable
                    disabled={proofBusy}
                    onPress={handleAskPhoto}
                    style={({ pressed }) => [
                      styles.smartProofCta,
                      {
                        backgroundColor: `${accentTheme.primary}18`,
                        borderColor: `${accentTheme.primary}55`,
                        opacity: pressed || proofBusy ? 0.85 : 1,
                      },
                    ]}>
                    <View
                      style={[
                        styles.smartProofIcon,
                        { backgroundColor: `${accentTheme.primary}28` },
                      ]}>
                      <MaterialIcons name="photo-camera" size={20} color={accentTheme.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typography.headline, { color: c.text }]}>Request a photo</Text>
                      <Text style={[typography.footnote, { color: c.textSoft }]}>
                        Ask {assigneeMember?.name ?? 'your Sidekick'} for a picture
                      </Text>
                    </View>
                    <MaterialIcons name="arrow-forward-ios" size={14} color={c.textMuted} />
                  </Pressable>
                ) : null}
                {v2Permissions.canApproveCompletion ? (
                  <Pressable
                    disabled={proofBusy}
                    onPress={handleMarkNotDone}
                    accessibilityRole="button"
                    accessibilityLabel="Mark not done"
                    style={({ pressed }) => [
                      styles.ghostDanger,
                      { borderColor: `${c.danger}55`, backgroundColor: `${c.danger}12` },
                      pressed && { opacity: 0.85 },
                      proofBusy && { opacity: 0.5 },
                    ]}>
                    <MaterialIcons name="undo" size={18} color={c.danger} />
                    <Text style={[styles.ghostDangerText, { color: c.danger }]}>
                      {proofBusy ? 'Working…' : 'Mark not done'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
            {!split &&
            task.status === 'Completed' &&
            (task.verification === 'unreviewed' ||
              task.verification === 'proof_requested' ||
              task.proofStatus === 'submitted') &&
            v2Permissions.canApproveCompletion ? (
              <>
                <DetailAction
                  disabled={proofBusy}
                  loading={proofBusy}
                  label="Confirm"
                  onPress={() => void handleConfirm()}
                />
                {canAskForPhoto ? (
                  <Pressable
                    disabled={proofBusy}
                    onPress={handleAskPhoto}
                    style={({ pressed }) => [
                      styles.smartProofCta,
                      {
                        backgroundColor: `${accentTheme.primary}18`,
                        borderColor: `${accentTheme.primary}55`,
                        opacity: pressed || proofBusy ? 0.85 : 1,
                      },
                    ]}>
                    <View
                      style={[
                        styles.smartProofIcon,
                        { backgroundColor: `${accentTheme.primary}28` },
                      ]}>
                      <MaterialIcons name="photo-camera" size={20} color={accentTheme.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typography.headline, { color: c.text }]}>
                        Ask for another photo
                      </Text>
                      <Text style={[typography.footnote, { color: c.textSoft }]}>
                        Send a fresh request to {assigneeMember?.name ?? 'your Sidekick'}
                      </Text>
                    </View>
                    <MaterialIcons name="arrow-forward-ios" size={14} color={c.textMuted} />
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={proofBusy}
                  onPress={handleMarkNotDone}
                  accessibilityRole="button"
                  accessibilityLabel="Mark not done"
                  style={({ pressed }) => [
                    styles.ghostDanger,
                    { borderColor: `${c.danger}55`, backgroundColor: `${c.danger}12` },
                    pressed && { opacity: 0.85 },
                    proofBusy && { opacity: 0.5 },
                  ]}>
                  <MaterialIcons name="undo" size={18} color={c.danger} />
                  <Text style={[styles.ghostDangerText, { color: c.danger }]}>
                    {proofBusy ? 'Working…' : 'Mark not done'}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {needsSidekickProofReply ? (
              <DetailAction label="Add a photo" onPress={() => setReplySheetOpen(true)} />
            ) : null}
            {split && myShare?.status === 'Completed' && task.status !== 'Completed' ? (
              <View style={[styles.waitCard, { borderColor: glassBorder(0.12), backgroundColor: glass(0.05) }]}>
                <MaterialIcons name="check-circle" size={18} color={c.success} />
                <Text style={[styles.waitText, { color: c.textSoft }]}>
                  Your share is done. Waiting on others — all-done bonus when everyone finishes.
                </Text>
              </View>
            ) : null}
            {canSendReminder ? (
              <DetailAction
                disabled={reminderBusy}
                loading={reminderBusy}
                label="Send reminder"
                onPress={handleSendReminder}
              />
            ) : null}
            {canAdjust && isOpenWork ? (
              <DetailAction
                disabled={busy}
                label={task.repeat !== 'None' ? 'Skip today' : 'Cancel task'}
                onPress={() => void skipToday()}
              />
            ) : null}
            {task.status === 'Cancelled' ? (
              <View style={[styles.waitCard, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
                <MaterialIcons name="block" size={18} color={c.textMuted} />
                <Text style={[styles.waitText, { color: c.textMuted }]}>
                  Cancelled by admin · not deleted
                </Text>
              </View>
            ) : null}
            {canEdit ? (
              <Pressable
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete task"
                style={({ pressed }) => [
                  styles.plainDanger,
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={[styles.plainDangerText, { color: c.danger }]}>Delete task</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        </ScrollView>
      </View>

      </View>
    </KeyboardAvoidingView>

      {/* Outside KAV — sheets lift themselves; nesting them under KAV double-scrolled the form. */}
      <TaskProofRequestSheet
        visible={requestSheetOpen}
        taskTitle={task.title}
        sidekickName={assigneeMember?.name ?? 'your Sidekick'}
        busy={proofBusy}
        onDismiss={() => setRequestSheetOpen(false)}
        onSend={async (note) => {
          setProofBusy(true);
          try {
            await requestAnotherProof(task.id, note);
            setRequestSheetOpen(false);
            orbitAlert(
              'Proof requested',
              `${assigneeMember?.name ?? 'Your Sidekick'} will get a notification to add a picture.`
            );
          } catch (error) {
            orbitAlert(
              'Couldn’t request proof',
              error instanceof Error ? error.message : 'Try again in a moment.'
            );
          } finally {
            setProofBusy(false);
          }
        }}
      />

      <TaskProofReplySheet
        visible={replySheetOpen}
        taskTitle={task.title}
        adminNote={latestAdminProofNote}
        busy={proofBusy}
        onDismiss={() => setReplySheetOpen(false)}
        onSubmit={async (input) => {
          setProofBusy(true);
          try {
            if (!input.proofUri?.trim()) {
              throw new Error('Add a photo before sending.');
            }
            // Always use the reply path when an admin asked for proof; otherwise attach on complete.
            if (input.proofUri && !input.note && task.verification !== 'proof_requested') {
              await submitTaskProof(task.id, input.proofUri, {
                forAssignee: split ? currentMember?.name : undefined,
                note: input.note,
              });
            } else {
              await submitProofReply(task.id, input);
            }
            setReplySheetOpen(false);
            orbitAlert('Proof sent');
          } catch (error) {
            orbitAlert(
              'Could not send proof',
              error instanceof Error ? error.message : 'Try again.'
            );
          } finally {
            setProofBusy(false);
          }
        }}
      />
    </>
  );
}

function DetailAction({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'ghost';
}) {
  const { accentTheme } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const inactive = disabled || loading;
  const ghost = tone === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailAction,
        ghost
          ? {
              backgroundColor: glass(0.06),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: glassBorder(0.14),
              opacity: inactive ? 0.5 : pressed ? 0.88 : 1,
            }
          : {
              backgroundColor: accentTheme.primary,
              opacity: inactive ? 0.5 : pressed ? 0.88 : 1,
            },
      ]}>
      {loading ? (
        <ActivityIndicator color={ghost ? c.text : c.ink} />
      ) : (
        <Text
          style={[
            typography.headline,
            { color: ghost ? c.text : c.ink, fontWeight: '700' },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
    </View>
  );
}

/** Renders a durable proof URL, or a clear empty state when the URI cannot load. */
function ProofPhotoPreview({ uri }: { uri: string }) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [failed, setFailed] = useState(false);
  const stuckLocal = isLocalProofUri(uri);

  if (failed || stuckLocal) {
    return (
      <View
        style={[
          styles.proofEmpty,
          { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) },
        ]}>
        <MaterialIcons name="broken-image" size={28} color={c.textMuted} />
        <Text style={[typography.footnote, { color: c.textSoft, textAlign: 'center' }]}>
          {stuckLocal
            ? 'This photo stayed on the Sidekick’s device. Ask them to send it again.'
            : 'Photo couldn’t load. Ask them to send it again.'}
        </Text>
      </View>
    );
  }

  return (
    <Image
      key={uri}
      source={{ uri }}
      style={[styles.proofImage, { backgroundColor: glass(0.06) }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '42%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerScroll: { flexGrow: 0 },
  footerContent: { gap: 10, paddingBottom: 4 },
  shareRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  penalizeChip: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  penalizeText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  xpWheelCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    paddingVertical: 8,
  },
  editCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingLeft: 18,
    paddingVertical: 14,
  },
  editStripe: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  editHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  editBadge: {
    alignItems: 'center',
    borderRadius: 13,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  editHeroKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  editHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editInput: {
    borderRadius: 14,
  },
  categoryChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  proofToggleCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  proofToggleIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  proofToggleTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    },
  headerCopy: { flex: 1, alignItems: 'center' },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaChipText: { fontSize: 12, fontWeight: '700' },
  proofHero: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  proofHeroIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  smartProofCta: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  smartProofIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  celebrateCard: {
    borderColor: 'rgba(52,211,153,0.3)',
    backgroundColor: 'rgba(52,211,153,0.1)',
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 16, lineHeight: 22 },
  detailRow: { gap: 6 },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 16 },
  proofImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  proofEmpty: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 160,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  waitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  waitText: { flex: 1, fontSize: 13, fontWeight: '700' },
  actionStack: {
    gap: 10,
    marginTop: 8,
  },
  detailAction: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  ghostDanger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ghostDangerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  plainDanger: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  plainDangerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceEmoji: { fontSize: 13 },
  choiceText: { fontSize: 12, fontWeight: '700' },
  missingTitle: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
});
