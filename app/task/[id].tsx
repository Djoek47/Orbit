import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { orbitColors } from '@/constants/orbit-theme';
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
import { isTaskLate } from '@/lib/tasks/xp';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';

const statusTone: Record<HouseholdTask['status'], string> = {
  Pending: '#38BDF8',
  'In Progress': '#06B6D4',
  Completed: '#34D399',
  Overdue: '#F87171',
  Cancelled: '#94A3B8',
};

const categories = ['Cleaning', 'Kitchen', 'Laundry', 'School', 'Homework', 'Groceries', 'Pets', 'Maintenance', 'General'];
const repeats: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];
const difficulties: NonNullable<HouseholdTask['difficulty']>[] = ['easy', 'medium', 'hard'];

function proofStatusLabel(status: HouseholdTask['proofStatus']) {
  switch (status) {
    case 'submitted':
      return 'Submitted · waiting for admin';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected · attach a new photo';
    default:
      return 'Required · not attached yet';
  }
}

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    accentTheme,
    approveTaskProof,
    cancelTask,
    completeTask,
    currentMember,
    deleteTask,
    household,
    penalizeSplitAssignee,
    permissions,
    submitTaskProof,
    updateTask,
  } = useOrbit();

  const task = household.tasks.find((item) => item.id === id);
  const rooms = household.rooms ?? [];
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
  const [roomId, setRoomId] = useState<string | undefined>(task?.roomId);
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
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missingTitle}>Task not found</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const split = isSplitTask(task);
  const myShare = currentMember ? getShare(task, currentMember.name) : undefined;
  const onThisSplit = taskMatchesAssignee(task, currentMember?.name);
  const assigneeMember = household.members.find((member) => member.name === task.assignee);
  const room = rooms.find((item) => item.id === (editing ? roomId : task.roomId));
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
  const canCompleteMine =
    !split ||
    (onThisSplit && myShare?.status === 'Pending');

  const handleComplete = async (forAssignee?: string) => {
    const result = await completeTask(task.id, forAssignee ? { forAssignee } : undefined);
    if (result) {
      setCelebration(result);
    }
  };

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

  const handleApproveProof = async (forAssignee?: string) => {
    setProofBusy(true);
    try {
      await approveTaskProof(task.id, forAssignee ? { forAssignee } : undefined);
      Alert.alert(
        'Proof approved',
        `${forAssignee ?? task.assignee} can finish their share.`
      );
    } finally {
      setProofBusy(false);
    }
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
        roomId,
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={orbitColors.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{task.category}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {editing ? 'Edit task' : 'Task'}
          </Text>
        </View>
        {canEdit && !editing ? (
          <Pressable onPress={() => setEditing(true)} style={styles.iconBtn} hitSlop={8}>
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
            <Text style={styles.heroTitle}>{task.title}</Text>
            <View style={styles.chipRow}>
              <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{task.status}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: `${accentTheme.primary}22` }]}>
                <Text style={[styles.statusText, { color: accentTheme.primary }]}>⚡ +{task.xp} XP</Text>
              </View>
              {task.repeat !== 'None' ? (
                <View style={styles.statusChip}>
                  <Text style={styles.metaChipText}>{task.repeat}</Text>
                </View>
              ) : null}
              {late && task.status !== 'Completed' ? (
                <View style={[styles.statusChip, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                  <Text style={[styles.statusText, { color: orbitColors.danger }]}>Late</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {celebration ? (
          <View style={[styles.card, styles.celebrateCard]}>
            <Text style={styles.cardTitle}>Nice work</Text>
            <Text style={styles.body}>
              +{celebration.awarded} XP
              {celebration.bonus ? ` (+${celebration.bonus} all-done bonus)` : ''}
              {celebration.late ? ` (−${celebration.penalty} late penalty)` : ''}. Rankings week XP
              {celebration.late ? ' held streak' : ' and streak'} updated.
            </Text>
          </View>
        ) : null}

        {editing ? (
          <View style={styles.card}>
            <Text style={styles.label}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={orbitColors.textSubtle} />
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.multiline]}
              multiline
              placeholderTextColor={orbitColors.textSubtle}
            />
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipWrap}>
              {categories.map((item) => {
                const active = category === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={[styles.choiceChip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, active && { color: accentTheme.primary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Assignee</Text>
            <View style={styles.chipWrap}>
              {memberNames.map((name) => {
                const active = assignee === name;
                const member = household.members.find((item) => item.name === name);
                return (
                  <Pressable
                    key={name}
                    onPress={() => setAssignee(name)}
                    style={[styles.choiceChip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={styles.choiceEmoji}>{member ? memberDisplayEmoji(member) : '👤'}</Text>
                    <Text style={[styles.choiceText, active && { color: accentTheme.primary }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Due</Text>
            <TextInput value={due} onChangeText={setDue} style={styles.input} placeholderTextColor={orbitColors.textSubtle} />
            <Text style={styles.label}>XP</Text>
            <TextInput
              value={xp}
              onChangeText={setXp}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={orbitColors.textSubtle}
            />
            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.chipWrap}>
              {difficulties.map((item) => {
                const active = difficulty === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setDifficulty(item)}
                    style={[styles.choiceChip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, active && { color: accentTheme.primary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Repeat</Text>
            <View style={styles.chipWrap}>
              {repeats.map((item) => {
                const active = repeat === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setRepeat(item)}
                    style={[styles.choiceChip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, active && { color: accentTheme.primary }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            {rooms.length ? (
              <>
                <Text style={styles.label}>Room</Text>
                <View style={styles.chipWrap}>
                  <Pressable
                    onPress={() => setRoomId(undefined)}
                    style={[styles.choiceChip, !roomId && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                    <Text style={[styles.choiceText, !roomId && { color: accentTheme.primary }]}>None</Text>
                  </Pressable>
                  {rooms.map((item) => {
                    const active = roomId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setRoomId(item.id)}
                        style={[styles.choiceChip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                        <Text style={styles.choiceEmoji}>{item.emoji}</Text>
                        <Text style={[styles.choiceText, active && { color: accentTheme.primary }]}>{item.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>{split ? 'Split between' : 'Assignee'}</Text>
              <View style={styles.assigneeRow}>
                {assigneeMember && !split ? (
                  <View style={[styles.avatar, { backgroundColor: `${memberColor}33` }]}>
                    <Text style={styles.avatarEmoji}>{memberDisplayEmoji(assigneeMember)}</Text>
                  </View>
                ) : null}
                <Text style={styles.value}>{task.assignee}</Text>
              </View>
            </View>
            {split && task.shares ? (
              <View style={styles.detailRow}>
                <Text style={styles.label}>Shares</Text>
                <Text style={styles.body}>
                  Each earns {splitShareXp(task)} XP · all-done bonus {splitAllDoneBonus(task)} XP · admin
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
                        <Text style={styles.value}>{share.name}</Text>
                        <Text style={styles.body}>
                          {share.status}
                          {needsProof ? ` · ${proofStatusLabel(share.proofStatus)}` : ''}
                          {share.awardedXp != null ? ` · +${share.awardedXp} XP` : ''}
                          {share.penalizedXp != null ? ` · −${share.penalizedXp} XP` : ''}
                        </Text>
                      </View>
                      {permissions.canManageHousehold && share.status === 'Pending' ? (
                        <Pressable onPress={() => handlePenalize(share.name)} style={styles.penalizeChip}>
                          <Text style={styles.penalizeText}>Penalize</Text>
                        </Pressable>
                      ) : null}
                      {permissions.canApproveReward &&
                      needsProof &&
                      share.proofStatus === 'submitted' ? (
                        <Pressable
                          disabled={proofBusy}
                          onPress={() => void handleApproveProof(share.name)}
                          style={styles.penalizeChip}>
                          <Text style={[styles.penalizeText, { color: accentTheme.primary }]}>
                            Approve
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
              value={`${task.xp} XP${task.weight ? ` · weight ${task.weight}` : ''}${task.difficulty ? ` · ${task.difficulty}` : ''}`}
            />
            <DetailRow label="Repeat" value={task.repeat} />
            {room ? <DetailRow label="Room" value={`${room.emoji} ${room.name}`} /> : null}
            {needsProof && !split ? (
              <DetailRow label="Proof" value={proofStatusLabel(task.proofStatus)} />
            ) : null}
            {showProofPreview ? (
              <View style={styles.detailRow}>
                <Text style={styles.label}>Attached photo</Text>
                <Image source={{ uri: myProofUri }} style={styles.proofImage} resizeMode="cover" />
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.body}>{task.description || 'No additional details for this task.'}</Text>
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
            <Pressable onPress={() => setEditing(false)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryMuted}>Cancel edit</Text>
            </Pressable>
          </>
        ) : (
          <>
            {needsProof &&
            task.status !== 'Completed' &&
            task.status !== 'Cancelled' &&
            canCompleteMine &&
            !proofReady ? (
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
                <MaterialIcons name="hourglass-top" size={18} color={orbitColors.warning} />
                <Text style={styles.waitText}>Proof sent to admin for review.</Text>
              </View>
            ) : null}
            {needsProof &&
            !split &&
            task.proofStatus === 'submitted' &&
            permissions.canApproveReward ? (
              <Pressable disabled={proofBusy} onPress={() => void handleApproveProof()} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>
                  {proofBusy ? 'Approving…' : 'Approve proof'}
                </Text>
              </Pressable>
            ) : null}
            {needsProof && myProofStatus === 'rejected' && canCompleteMine ? (
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
                  <Text style={styles.ctaText}>{proofBusy ? 'Sending proof…' : 'Re-attach proof photo'}</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
            {task.status !== 'Completed' &&
            task.status !== 'Cancelled' &&
            canCompleteMine ? (
              <Pressable
                disabled={needsProof && !proofReady}
                onPress={() => void handleComplete(split ? currentMember?.name : undefined)}
                style={[styles.ctaWrap, needsProof && !proofReady && { opacity: 0.45 }]}>
                <LinearGradient
                  colors={[accentTheme.primary, accentTheme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}>
                  <Text style={styles.ctaText}>
                    {needsProof && !proofReady
                      ? 'Proof required to complete'
                      : split
                        ? 'Mark my share complete'
                        : 'Mark complete'}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
            {split && myShare?.status === 'Completed' && task.status !== 'Completed' ? (
              <View style={styles.waitCard}>
                <MaterialIcons name="check-circle" size={18} color={orbitColors.success} />
                <Text style={styles.waitText}>
                  Your share is done. Waiting on others — all-done bonus when everyone finishes.
                </Text>
              </View>
            ) : null}
            {permissions.canManageHousehold && task.status !== 'Completed' && task.status !== 'Cancelled' ? (
              <Pressable onPress={confirmCancel} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryText, { color: orbitColors.warning }]}>
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
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1525' },
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
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  kicker: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: orbitColors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, gap: 12 },
  heroTitle: { color: orbitColors.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaChipText: { color: orbitColors.textMuted, fontSize: 12, fontWeight: '700' },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    gap: 12,
  },
  celebrateCard: {
    borderColor: 'rgba(52,211,153,0.3)',
    backgroundColor: 'rgba(52,211,153,0.1)',
  },
  cardTitle: { color: orbitColors.text, fontSize: 16, fontWeight: '800' },
  label: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: { color: orbitColors.text, fontSize: 16, fontWeight: '700' },
  body: { color: orbitColors.textSoft, fontSize: 14, lineHeight: 20 },
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
  waitText: { flex: 1, color: orbitColors.warning, fontSize: 13, fontWeight: '700' },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: orbitColors.text,
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceEmoji: { fontSize: 13 },
  choiceText: { color: orbitColors.textMuted, fontSize: 12, fontWeight: '700' },
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  secondaryMuted: { color: orbitColors.textMuted, fontSize: 14, fontWeight: '700' },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  dangerText: { color: orbitColors.danger, fontSize: 14, fontWeight: '700' },
  missingTitle: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
});
