import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { XpWheel } from '@/components/orbit/xp-wheel';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { VOCAB } from '@/constants/vocabulary';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { promptPickProofPhoto } from '@/lib/tasks/pick-proof';
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
import { isTaskLate } from '@/lib/tasks/xp';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

const statusTone: Record<HouseholdTask['status'], string> = {
  Pending: '#38BDF8',
  'In Progress': '#06B6D4',
  Completed: '#34D399',
  Overdue: '#F87171',
  Cancelled: '#94A3B8',
  Expired: '#F59E0B',
  Missed: '#F59E0B',
};

const categories = ['Cleaning', 'Kitchen', 'Laundry', 'School', 'Homework', 'Groceries', 'Pets', 'Maintenance', 'General'];
const repeats: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];
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
  const { id } = useLocalSearchParams<{ id: string }>();
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
    submitTaskProof,
    updateTask,
    v2Permissions,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
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
  const [category, setCategory] = useState(task?.category ?? categories[0]);
  const [assignee, setAssignee] = useState(task?.assignee ?? '');
  const [due, setDue] = useState(task?.due ?? '');
  const [xp, setXp] = useState(String(task?.xp ?? 15));
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>(task?.repeat ?? 'None');
  const [difficulty, setDifficulty] = useState<HouseholdTask['difficulty']>(task?.difficulty ?? 'medium');
  const [busy, setBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [celebration, setCelebration] = useState<{
    awarded: number;
    penalty: number;
    late: boolean;
    bonus?: number;
  } | null>(null);

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
        <Pressable onPress={() => router.back()} style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
          <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const split = isSplitTask(task);
  const myShare = currentMember ? getShare(task, currentMember.name) : undefined;
  const onThisSplit = taskMatchesAssignee(task, currentMember?.name);
  const assigneeMember = household.members.find((member) => member.name === task.assignee);
  const canEdit = permissions.canCreateTask || permissions.canAssignTask;
  const needsProof = Boolean(task.proofRequired);
  const myProofStatus = split ? myShare?.proofStatus : task.proofStatus;
  const proofReady = myProofStatus === 'submitted' || myProofStatus === 'approved';
  const late = isTaskLate(task);
  const statusColor = statusTone[task.status];
  const memberColor = assigneeMember
    ? MEMBER_ACCENTS[assigneeMember.name]?.color ?? accentTheme.primary
    : accentTheme.primary;
  const myProofUri = split ? myShare?.proofUri : task.proofUri;
  const showProofPreview = Boolean(
    myProofUri && (myProofStatus === 'submitted' || myProofStatus === 'approved')
  );
  const canCompleteMine = split
    ? Boolean(onThisSplit && myShare?.status === 'Pending')
    : Boolean(
        currentMember &&
          taskMatchesAssignee(task, currentMember.name) &&
          task.status !== 'Completed' &&
          task.status !== 'Cancelled' &&
          task.status !== 'Expired' &&
          task.status !== 'Missed'
      );

  const handleAttachProof = async (forAssignee?: string) => {
    const uri = await promptPickProofPhoto();
    if (!uri) return;
    setProofBusy(true);
    try {
      await submitTaskProof(task.id, uri, forAssignee ? { forAssignee } : undefined);
      Alert.alert('Proof sent', 'An admin was notified to review your photo.');
    } finally {
      setProofBusy(false);
    }
  };

  const handleComplete = async (forAssignee?: string) => {
    const result = await completeTask(task.id, forAssignee ? { forAssignee } : undefined);
    if (result) {
      setCelebration(result);
      if (result.needsProof) {
        // Request proof once after the task (or share) is completed.
        void handleAttachProof(forAssignee);
      }
    }
  };

  const handleConfirm = async () => {
    setProofBusy(true);
    try {
      const ok = await confirmVerification(task.id);
      if (ok) Alert.alert('Confirmed', 'Verification saved for this completion.');
    } finally {
      setProofBusy(false);
    }
  };

  const handleAskPhoto = () => {
    const firstAsk = task.verification === 'not_required';
    Alert.alert(
      firstAsk ? 'Ask for photo' : 'Ask for another photo',
      firstAsk
        ? 'Request a photo of this completed chore?'
        : 'Send a request for another photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            void (async () => {
              setProofBusy(true);
              try {
                await requestAnotherProof(task.id);
              } finally {
                setProofBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleMarkNotDone = () => {
    Alert.alert('Mark not done?', 'This reverses the XP awarded for this completion.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark not done',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setProofBusy(true);
            try {
              await markNotDone(task.id);
            } finally {
              setProofBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const handlePenalize = (name: string) => {
    const dock = splitPenaltyAmount(task);
    Alert.alert(
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
                Alert.alert('Penalty applied', `${name} lost ${amount} XP.`);
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
        category,
        assignee,
        due,
        xp: Number(xp) || task.xp,
        repeat,
        difficulty,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete task', 'Remove this task from the household list?', [
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

  const confirmCancel = () => {
    if (!permissions.canManageHousehold) {
      Alert.alert('Admins only', 'Only household admins can cancel tasks.');
      return;
    }
    const recurring = task.repeat !== 'None';
    const overdueNote = task.status === 'Overdue' ? ' This overdue task can still be cancelled.' : '';

    if (!recurring) {
      Alert.alert('Cancel task', `Cancel “${task.title}”?${overdueNote} This keeps a cancelled record (not a delete).`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel task',
          style: 'destructive',
          onPress: async () => {
            await cancelTask(task.id, 'this');
            router.back();
          },
        },
      ]);
      return;
    }

    Alert.alert(
      'Cancel recurring task',
      `“${task.title}” repeats ${task.repeat}.${overdueNote} Cancel just this occurrence, or this and all future ones?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'This occurrence',
          onPress: async () => {
            await cancelTask(task.id, 'this');
            router.back();
          },
        },
        {
          text: 'This + all future',
          style: 'destructive',
          onPress: async () => {
            await cancelTask(task.id, 'future');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.handle, { backgroundColor: glass(0.18) }]} />
      <View style={[styles.header, { borderBottomColor: glassBorder(0.08) }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: glass(0.06) }]} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: c.textMuted }]}>{task.category}</Text>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {editing ? 'Edit task' : 'Task'}
          </Text>
        </View>
        {canEdit && !editing ? (
          <Pressable onPress={() => setEditing(true)} style={[styles.iconBtn, { backgroundColor: glass(0.06) }]} hitSlop={8}>
            <MaterialIcons name="edit" size={16} color={accentTheme.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {!editing ? (
          <>
            <Text style={[styles.heroTitle, { color: c.text }]}>{task.title}</Text>
            <View style={styles.chipRow}>
              <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {task.status === 'Missed' ? VOCAB.expired : task.status}
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: `${accentTheme.primary}22` }]}>
                <Text style={[styles.statusText, { color: accentTheme.primary }]}>
                  ⚡ +{taskDisplayXp} XP
                </Text>
              </View>
              {task.repeat !== 'None' ? (
                <View style={[styles.statusChip, { backgroundColor: glass(0.06) }]}>
                  <Text style={[styles.metaChipText, { color: c.textMuted }]}>{task.repeat}</Text>
                </View>
              ) : null}
              {task.completedLate && task.status === 'Completed' ? (
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
              ) : late && task.status !== 'Completed' ? (
                <View style={[styles.statusChip, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                  <Text style={[styles.statusText, { color: c.danger }]}>Late</Text>
                </View>
              ) : null}
            </View>
          </>
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
          <View style={[styles.card, { borderColor: glassBorder(0.08), backgroundColor: glass(0.05) }]}>
            <Text style={[styles.label, { color: c.textMuted }]}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} style={[styles.input, { color: c.text, backgroundColor: glass(0.04), borderColor: glassBorder(0.1) }]} placeholderTextColor={c.textSubtle} />
            <Text style={[styles.label, { color: c.textMuted }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.multiline, { color: c.text, backgroundColor: glass(0.04), borderColor: glassBorder(0.1) }]}
              multiline
              placeholderTextColor={c.textSubtle}
            />
            <Text style={[styles.label, { color: c.textMuted }]}>Category</Text>
            <View style={styles.chipWrap}>
              {categories.map((item) => {
                const active = category === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={[styles.choiceChip, { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) }, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, { color: c.textMuted }, active && { color: accentTheme.primary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>Assignee</Text>
            <View style={styles.chipWrap}>
              {memberNames.map((name) => {
                const active = assignee === name;
                const member = household.members.find((item) => item.name === name);
                return (
                  <Pressable
                    key={name}
                    onPress={() => setAssignee(name)}
                    style={[styles.choiceChip, { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) }, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={styles.choiceEmoji}>{member ? memberDisplayEmoji(member) : '👤'}</Text>
                    <Text style={[styles.choiceText, { color: c.textMuted }, active && { color: accentTheme.primary }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>Due</Text>
            <TextInput value={due} onChangeText={setDue} style={[styles.input, { color: c.text, backgroundColor: glass(0.04), borderColor: glassBorder(0.1) }]} placeholderTextColor={c.textSubtle} />
            <Text style={[styles.label, { color: c.textMuted }]}>XP · slide the wheel</Text>
            <View style={[styles.xpWheelCard, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}>
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
                return (
                  <Pressable
                    key={item}
                    onPress={() => setDifficulty(item)}
                    style={[styles.choiceChip, { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) }, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, { color: c.textMuted }, active && { color: accentTheme.primary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>Repeat</Text>
            <View style={styles.chipWrap}>
              {repeats.map((item) => {
                const active = repeat === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setRepeat(item)}
                    style={[styles.choiceChip, { borderColor: glassBorder(0.12), backgroundColor: glass(0.03) }, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, { color: c.textMuted }, active && { color: accentTheme.primary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.card, { borderColor: glassBorder(0.08), backgroundColor: glass(0.05) }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>{split ? 'Split between' : 'Assignee'}</Text>
              <View style={styles.assigneeRow}>
                {assigneeMember && !split ? (
                  <View style={[styles.avatar, { backgroundColor: `${memberColor}33` }]}>
                    <Text style={styles.avatarEmoji}>{memberDisplayEmoji(assigneeMember)}</Text>
                  </View>
                ) : null}
                <Text style={[styles.value, { color: c.text }]}>{task.assignee}</Text>
              </View>
            </View>
            {(late || task.status === 'Overdue') &&
            task.status !== 'Completed' &&
            task.status !== 'Cancelled' &&
            (permissions.canAssignTask || permissions.canManageHousehold) ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: c.textMuted }]}>Reassign (overdue)</Text>
                <Text style={[styles.body, { color: c.textSoft }]}>
                  Hand this to someone else. They earn the XP when they finish.
                </Text>
                <View style={styles.chipWrap}>
                  {memberNames
                    .filter((name) => name !== task.assignee)
                    .map((name) => (
                      <Pressable
                        key={`reassign-${name}`}
                        onPress={() => {
                          Alert.alert(
                            'Reassign task',
                            `Move “${task.title}” to ${name}? ${task.assignee} will not earn XP for it.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: `Give to ${name}`,
                                onPress: () => void reassignTask(task.id, name),
                              },
                            ]
                          );
                        }}
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
                          {person ? memberDisplayEmoji(person) : '👤'}
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
            <DetailRow label="Due" value={task.due} />
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
            <DetailRow label="Repeat" value={task.repeat} />
            {needsProof && !split ? (
              <DetailRow
                label="Proof"
                value={proofStatusLabel(task.proofStatus, task.status === 'Completed')}
              />
            ) : null}
            {showProofPreview ? (
              <View style={styles.detailRow}>
                <Text style={[styles.label, { color: c.textMuted }]}>Attached photo</Text>
                <Image source={{ uri: myProofUri }} style={[styles.proofImage, { backgroundColor: glass(0.06) }]} resizeMode="cover" />
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>Description</Text>
              <Text style={[styles.body, { color: c.textSoft }]}>{task.description || 'No additional details for this task.'}</Text>
            </View>
          </View>
        )}

        {editing ? (
          <>
            <Pressable disabled={busy || title.trim().length < 2} onPress={() => void handleSave()} style={styles.ctaWrap}>
              <LinearGradient
                colors={[accentTheme.primary, accentTheme.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}>
                <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Save changes'}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setEditing(false)} style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
              <Text style={[styles.secondaryMuted, { color: c.textMuted }]}>Cancel edit</Text>
            </Pressable>
          </>
        ) : (
          <>
            {task.status !== 'Completed' &&
            task.status !== 'Cancelled' &&
            canCompleteMine ? (
              <Pressable
                onPress={() => void handleComplete(split ? currentMember?.name : undefined)}
                style={styles.ctaWrap}>
                <LinearGradient
                  colors={[accentTheme.primary, accentTheme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}>
                  <Text style={styles.ctaText}>
                    {split ? 'Mark my share complete' : 'Mark complete'}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
            {needsProof &&
            !proofReady &&
            canCompleteMine &&
            (task.status === 'Completed' || (split && myShare?.status === 'Completed')) ? (
              <Pressable
                disabled={proofBusy}
                onPress={() => void handleAttachProof(split ? currentMember?.name : undefined)}
                style={[styles.ctaWrap, proofBusy && { opacity: 0.6 }]}>
                <LinearGradient
                  colors={[accentTheme.primary, accentTheme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}>
                  <MaterialIcons name="photo-camera" size={18} color="#04101F" />
                  <Text style={styles.ctaText}>
                    {proofBusy
                      ? 'Sending proof…'
                      : myProofStatus === 'rejected'
                        ? 'Re-attach proof photo'
                        : split
                          ? 'Attach my proof photo'
                          : 'Attach proof photo'}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
            {needsProof &&
            myProofStatus === 'submitted' &&
            !permissions.canApproveReward &&
            canCompleteMine ? (
              <View style={styles.waitCard}>
                <MaterialIcons name="hourglass-top" size={18} color={c.warning} />
                <Text style={styles.waitText}>Proof sent to admin for review.</Text>
              </View>
            ) : null}
            {!split &&
            task.status === 'Completed' &&
            task.verification === 'not_required' &&
            (v2Permissions.canRequestProof || v2Permissions.canApproveCompletion) ? (
              <View style={{ gap: 8 }}>
                {v2Permissions.canRequestProof ? (
                  <Pressable
                    disabled={proofBusy}
                    onPress={handleAskPhoto}
                    style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
                    <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>
                      {proofBusy ? 'Working…' : 'Ask for photo'}
                    </Text>
                  </Pressable>
                ) : null}
                {v2Permissions.canApproveCompletion ? (
                  <Pressable
                    disabled={proofBusy}
                    onPress={handleMarkNotDone}
                    style={[styles.secondaryBtn, { borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.08)' }]}>
                    <Text style={[styles.secondaryText, { color: '#F87171' }]}>Mark not done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {!split &&
            task.status === 'Completed' &&
            (task.verification === 'unreviewed' ||
              task.verification === 'proof_requested' ||
              task.proofStatus === 'submitted') &&
            v2Permissions.canApproveCompletion ? (
              <View style={{ gap: 8 }}>
                <Pressable
                  disabled={proofBusy}
                  onPress={() => void handleConfirm()}
                  style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
                  <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>
                    {proofBusy ? 'Working…' : 'Confirm'}
                  </Text>
                </Pressable>
                {v2Permissions.canRequestProof ? (
                  <Pressable
                    disabled={proofBusy}
                    onPress={handleAskPhoto}
                    style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
                    <Text style={[styles.secondaryText, { color: c.textMuted }]}>
                      Ask for another photo
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={proofBusy}
                  onPress={handleMarkNotDone}
                  style={[styles.secondaryBtn, { borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.08)' }]}>
                  <Text style={[styles.secondaryText, { color: '#F87171' }]}>Mark not done</Text>
                </Pressable>
              </View>
            ) : null}
            {task.verification === 'proof_requested' && canCompleteMine ? (
              <Pressable
                disabled={proofBusy}
                onPress={() => void handleAttachProof(split ? currentMember?.name : undefined)}
                style={[styles.ctaWrap, proofBusy && { opacity: 0.6 }]}>
                <LinearGradient
                  colors={[accentTheme.primary, accentTheme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}>
                  <MaterialIcons name="photo-camera" size={18} color="#04101F" />
                  <Text style={styles.ctaText}>
                    {proofBusy ? 'Sending…' : 'Add another photo'}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
            {split && myShare?.status === 'Completed' && task.status !== 'Completed' ? (
              <View style={styles.waitCard}>
                <MaterialIcons name="check-circle" size={18} color={c.success} />
                <Text style={styles.waitText}>
                  Your share is done. Waiting on others — all-done bonus when everyone finishes.
                </Text>
              </View>
            ) : null}
            {permissions.canManageHousehold && task.status !== 'Completed' && task.status !== 'Cancelled' ? (
              <Pressable onPress={confirmCancel} style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
                <Text style={[styles.secondaryText, { color: c.warning }]}>
                  Cancel task{task.status === 'Overdue' ? ' (overdue ok)' : ''}
                </Text>
              </Pressable>
            ) : null}
            {task.status === 'Cancelled' ? (
              <View style={styles.waitCard}>
                <MaterialIcons name="block" size={18} color="#94A3B8" />
                <Text style={[styles.waitText, { color: '#94A3B8' }]}>
                  Cancelled by admin · not deleted
                </Text>
              </View>
            ) : null}
            {canEdit ? (
              <Pressable onPress={confirmDelete} style={styles.dangerBtn}>
                <Text style={styles.dangerText}>Delete task</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  content: { padding: 16, gap: 12 },
  heroTitle: { fontSize: 24, fontWeight: '800', lineHeight: 30 },
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
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
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
  value: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
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
    height: 200,
    borderRadius: 16,
    },
  waitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.35)',
    backgroundColor: 'rgba(251,146,60,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  waitText: { flex: 1, color: '#FB923C', fontSize: 13, fontWeight: '700' },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
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
  ctaWrap: { borderRadius: 18, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  ctaText: { color: '#04101F', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  secondaryMuted: { fontSize: 14, fontWeight: '700' },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  dangerText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
  missingTitle: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
});
