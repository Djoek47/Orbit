import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TASK_PRESETS, type TaskPreset } from '@/data/task-presets';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { computeTaskXp, weightForDifficulty } from '@/lib/tasks/xp';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask, TaskDifficulty } from '@/types/orbit';

type TaskType = 'task' | 'homework';
type ScreenMode = 'presets' | 'custom';

const PANEL_BG = '#0F1A30';

const subjects = [
  { label: 'Math', emoji: '🔢', color: '#38BDF8' },
  { label: 'English', emoji: '📖', color: '#A78BFA' },
  { label: 'Science', emoji: '🧪', color: '#34D399' },
  { label: 'History', emoji: '🏛️', color: '#FB923C' },
  { label: 'Art', emoji: '🎨', color: '#F472B6' },
  { label: 'PE', emoji: '⚽', color: '#FBBF24' },
] as const;

const dueOptions = ['Today', 'Tomorrow', 'This week', 'Next week'] as const;

const priorities = [
  { label: 'Low', color: '#34D399', xp: 5, difficulty: 'easy' as TaskDifficulty },
  { label: 'Medium', color: '#38BDF8', xp: 10, difficulty: 'medium' as TaskDifficulty },
  { label: 'High', color: '#FB923C', xp: 20, difficulty: 'hard' as TaskDifficulty },
];

const repeatOptions: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];

const GRADIENT_BY_COLOR: Record<string, [string, string]> = {
  '#38BDF8': ['#38BDF8', '#0EA5E9'],
  '#A78BFA': ['#A78BFA', '#7C3AED'],
  '#34D399': ['#34D399', '#059669'],
  '#FB923C': ['#FB923C', '#EA580C'],
  '#F472B6': ['#F472B6', '#EC4899'],
  '#94A3B8': ['#94A3B8', '#64748B'],
};

function memberAccent(member: HouseholdMember) {
  return MEMBER_ACCENTS[member.name] ?? { color: '#38BDF8', emoji: memberDisplayEmoji(member) };
}

function memberGradient(color: string): [string, string] {
  return GRADIENT_BY_COLOR[color] ?? [color, color];
}

export default function CreateTaskScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, createTask, household, permissions } = useOrbit();

  const activeMembers = useMemo(
    () => household.members.filter((member) => member.status === 'active'),
    [household.members],
  );

  const rooms = household.rooms ?? [];

  const [mode, setMode] = useState<ScreenMode>('presets');
  const [type, setType] = useState<TaskType>('task');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<(typeof subjects)[number]['label']>('Math');
  const [assigneeId, setAssigneeId] = useState(activeMembers[0]?.id ?? '');
  const [due, setDue] = useState<(typeof dueOptions)[number]>('Today');
  const [priority, setPriority] = useState(1);
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('medium');
  const [proofRequired, setProofRequired] = useState(false);
  const [roomId, setRoomId] = useState<string | undefined>();
  const [baseXp, setBaseXp] = useState(10);
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState<string | undefined>();

  const assignee = activeMembers.find((member) => member.id === assigneeId);
  const assigneeName = permissions.canAssignTask
    ? (assignee?.name ?? household.greetingName)
    : household.greetingName;

  const weight = weightForDifficulty(type === 'homework' ? 'medium' : difficulty);
  const xpPreview =
    type === 'homework' ? computeTaskXp(15, weightForDifficulty('medium'), 'medium') : computeTaskXp(baseXp, weight, difficulty);
  const canCreate = title.trim().length > 0;

  function roomIdForKind(kind?: TaskPreset['roomKind']) {
    if (!kind) return undefined;
    return rooms.find((room) => room.kind === kind)?.id;
  }

  function applyPreset(preset: TaskPreset, createNow: boolean) {
    const nextRoomId = roomIdForKind(preset.roomKind);
    const nextXp = computeTaskXp(preset.baseXp, preset.weight, preset.difficulty);
    const nextAssignee = assigneeName;

    if (createNow) {
      createTask({
        title: preset.title,
        description: preset.description,
        category: preset.category,
        assignee: nextAssignee,
        due: 'Today',
        xp: nextXp,
        repeat: preset.repeat,
        difficulty: preset.difficulty,
        weight: preset.weight,
        proofRequired: preset.proofRequired,
        roomId: nextRoomId,
      });
      router.back();
      return;
    }

    setMode('custom');
    setType(preset.category === 'Homework' ? 'homework' : 'task');
    setTitle(preset.title);
    setCategory(preset.category);
    setDescription(preset.description);
    setRepeat(preset.repeat);
    setDifficulty(preset.difficulty);
    setProofRequired(preset.proofRequired);
    setBaseXp(preset.baseXp);
    setRoomId(nextRoomId);
    const priorityIndex = Math.max(
      0,
      priorities.findIndex((item) => item.difficulty === preset.difficulty),
    );
    setPriority(priorityIndex >= 0 ? priorityIndex : 1);
  }

  if (!permissions.canCreateTask) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.lockedTitle}>Creating tasks is locked</Text>
        <Text style={styles.lockedBody}>Your role can complete assigned work, but not create new tasks.</Text>
        <Pressable onPress={() => router.back()} style={styles.closeOnly}>
          <Text style={styles.closeOnlyText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleCreate = () => {
    if (!canCreate) return;

    const trimmedTitle = title.trim();

    if (type === 'homework') {
      createTask({
        title: trimmedTitle,
        description: description ?? `Subject: ${subject}`,
        category: 'Homework',
        assignee: assigneeName,
        due,
        xp: computeTaskXp(15, weightForDifficulty('medium'), 'medium'),
        repeat,
        difficulty: 'medium',
        weight: weightForDifficulty('medium'),
        proofRequired,
        roomId,
      });
    } else {
      const selectedPriority = priorities[priority];
      createTask({
        title: trimmedTitle,
        description,
        category,
        assignee: assigneeName,
        due,
        xp: computeTaskXp(baseXp || selectedPriority.xp, weight, difficulty),
        repeat,
        difficulty,
        weight,
        proofRequired,
        roomId,
      });
    }

    router.back();
  };

  if (mode === 'presets') {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.handle} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick presets</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
              <MaterialIcons color="#7C9CC0" name="close" size={16} />
            </Pressable>
          </View>
          <Text style={styles.presetHint}>Tap once to create · long-press to customize</Text>
          <View style={styles.presetGrid}>
            {TASK_PRESETS.map((preset) => {
              const room = rooms.find((item) => item.kind === preset.roomKind);
              const xp = computeTaskXp(preset.baseXp, preset.weight, preset.difficulty);
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => applyPreset(preset, true)}
                  onLongPress={() => applyPreset(preset, false)}
                  style={styles.presetCard}>
                  <View style={styles.presetTop}>
                    <Text style={styles.presetTitle}>{preset.title}</Text>
                    <View style={[styles.xpBadge, { backgroundColor: `${accentTheme.primary}22` }]}>
                      <Text style={[styles.xpBadgeText, { color: accentTheme.primary }]}>+{xp}</Text>
                    </View>
                  </View>
                  <View style={styles.presetMetaRow}>
                    <View style={styles.repeatPill}>
                      <Text style={styles.repeatText}>{preset.repeat}</Text>
                    </View>
                    {room ? (
                      <Text style={styles.roomChip}>
                        {room.emoji} {room.name}
                      </Text>
                    ) : (
                      <Text style={styles.roomChip}>{preset.category}</Text>
                    )}
                  </View>
                  {preset.proofRequired ? (
                    <Text style={styles.proofHint}>Proof required</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              setMode('custom');
              setTitle('');
              setCategory('General');
              setRepeat('None');
              setDifficulty('medium');
              setProofRequired(false);
              setBaseXp(10);
              setRoomId(undefined);
            }}
            style={styles.customEntry}>
            <MaterialIcons name="edit" size={16} color={accentTheme.primary} />
            <Text style={[styles.customEntryText, { color: accentTheme.primary }]}>Custom task</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.handle} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => setMode('presets')} style={styles.backChip}>
            <MaterialIcons name="chevron-left" size={18} color="#7C9CC0" />
            <Text style={styles.backChipText}>Presets</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Custom task</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
            <MaterialIcons color="#7C9CC0" name="close" size={16} />
          </Pressable>
        </View>

        <View style={styles.typeToggle}>
          {(['task', 'homework'] as const).map((option) => {
            const active = type === option;
            const isHomework = option === 'homework';
            return (
              <Pressable
                key={option}
                onPress={() => setType(option)}
                style={[
                  styles.typeOption,
                  active && {
                    backgroundColor: isHomework ? 'rgba(167,139,250,0.2)' : `${accentTheme.primary}33`,
                    borderColor: isHomework ? 'rgba(167,139,250,0.2)' : `${accentTheme.primary}33`,
                  },
                ]}>
                <MaterialIcons
                  color={active ? (isHomework ? '#A78BFA' : accentTheme.primary) : '#4B6080'}
                  name={isHomework ? 'menu-book' : 'check-box'}
                  size={15}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    active && { color: isHomework ? '#A78BFA' : accentTheme.primary },
                  ]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{type === 'homework' ? 'ASSIGNMENT' : 'TASK'}</Text>
          <TextInput
            autoFocus
            onChangeText={setTitle}
            placeholder={type === 'homework' ? 'e.g. Chapter 5 worksheet' : 'e.g. Call plumber about sink'}
            placeholderTextColor="#4B6080"
            style={styles.titleInput}
            value={title}
          />
        </View>

        {type === 'homework' ? (
          <View style={styles.field}>
            <Text style={styles.label}>SUBJECT</Text>
            <View style={styles.subjectRow}>
              {subjects.map((item) => {
                const active = subject === item.label;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => setSubject(item.label)}
                    style={[
                      styles.subjectChip,
                      {
                        backgroundColor: active ? `${item.color}22` : 'rgba(255,255,255,0.06)',
                        borderColor: active ? `${item.color}44` : 'rgba(255,255,255,0.08)',
                      },
                    ]}>
                    <Text style={styles.subjectEmoji}>{item.emoji}</Text>
                    <Text style={[styles.subjectText, { color: active ? item.color : '#7C9CC0' }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {priorities.map((item, index) => {
                const active = priority === index;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      setPriority(index);
                      setDifficulty(item.difficulty);
                      setBaseXp(item.xp);
                    }}
                    style={[
                      styles.priorityChip,
                      {
                        backgroundColor: active ? `${item.color}22` : 'rgba(255,255,255,0.06)',
                        borderColor: active ? `${item.color}44` : 'rgba(255,255,255,0.08)',
                      },
                    ]}>
                    <Text style={[styles.priorityText, { color: active ? item.color : '#7C9CC0' }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>REPEAT</Text>
          <View style={styles.subjectRow}>
            {repeatOptions.map((option) => {
              const active = repeat === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setRepeat(option)}
                  style={[
                    styles.subjectChip,
                    active && {
                      backgroundColor: `${accentTheme.primary}22`,
                      borderColor: `${accentTheme.primary}44`,
                    },
                  ]}>
                  <Text style={[styles.subjectText, { color: active ? accentTheme.primary : '#7C9CC0' }]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {rooms.length ? (
          <View style={styles.field}>
            <Text style={styles.label}>ROOM (OPTIONAL)</Text>
            <View style={styles.subjectRow}>
              <Pressable
                onPress={() => setRoomId(undefined)}
                style={[
                  styles.subjectChip,
                  !roomId && {
                    backgroundColor: `${accentTheme.primary}22`,
                    borderColor: `${accentTheme.primary}44`,
                  },
                ]}>
                <Text style={[styles.subjectText, { color: !roomId ? accentTheme.primary : '#7C9CC0' }]}>
                  None
                </Text>
              </Pressable>
              {rooms.map((room) => {
                const active = roomId === room.id;
                return (
                  <Pressable
                    key={room.id}
                    onPress={() => setRoomId(room.id)}
                    style={[
                      styles.subjectChip,
                      active && {
                        backgroundColor: `${accentTheme.primary}22`,
                        borderColor: `${accentTheme.primary}44`,
                      },
                    ]}>
                    <Text style={styles.subjectEmoji}>{room.emoji}</Text>
                    <Text style={[styles.subjectText, { color: active ? accentTheme.primary : '#7C9CC0' }]}>
                      {room.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => setProofRequired((value) => !value)} style={styles.proofToggle}>
          <MaterialIcons
            name={proofRequired ? 'check-box' : 'check-box-outline-blank'}
            size={18}
            color={proofRequired ? accentTheme.primary : '#4B6080'}
          />
          <Text style={styles.proofToggleText}>Require photo proof</Text>
        </Pressable>

        <View style={styles.assignDueRow}>
          {permissions.canAssignTask ? (
            <View style={styles.assignColumn}>
              <Text style={styles.label}>ASSIGN TO</Text>
              <View style={styles.memberRow}>
                {activeMembers.map((member) => {
                  const accent = memberAccent(member);
                  const selected = assigneeId === member.id;
                  const gradient = memberGradient(accent.color);
                  return (
                    <Pressable
                      key={member.id}
                      accessibilityLabel={member.name}
                      onPress={() => setAssigneeId(member.id)}
                      style={[
                        styles.memberOuter,
                        selected && {
                          borderColor: accent.color,
                          shadowColor: accent.color,
                          shadowOpacity: 0.25,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 0 },
                        },
                      ]}>
                      {selected ? (
                        <LinearGradient colors={gradient} style={styles.memberInner}>
                          <Text style={styles.memberEmoji}>{memberDisplayEmoji(member)}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.memberInnerMuted}>
                          <Text style={styles.memberEmoji}>{memberDisplayEmoji(member)}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={[styles.dueColumn, !permissions.canAssignTask && styles.dueColumnFull]}>
            <Text style={styles.label}>DUE</Text>
            <View style={styles.dueChipWrap}>
              {dueOptions.map((option) => {
                const active = due === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setDue(option)}
                    style={[
                      styles.dueChip,
                      active && {
                        backgroundColor: `${accentTheme.primary}1F`,
                        borderColor: `${accentTheme.primary}59`,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.dueChipText,
                        active && { color: accentTheme.primary },
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={[styles.xpPreview, { borderColor: `${accentTheme.primary}26`, backgroundColor: `${accentTheme.primary}14` }]}>
          <Text style={styles.xpPreviewLabel}>{assigneeName} will earn</Text>
          <View style={styles.xpPreviewValue}>
            <Text style={styles.xpBolt}>⚡</Text>
            <Text style={[styles.xpAmount, { color: accentTheme.primary }]}>+{xpPreview}</Text>
            <Text style={styles.xpSuffix}>XP</Text>
          </View>
        </View>

        <Pressable disabled={!canCreate} onPress={handleCreate} style={styles.createPressable}>
          {canCreate ? (
            <LinearGradient
              colors={
                type === 'homework'
                  ? ['#A78BFA', '#7C3AED']
                  : [accentTheme.primary, accentTheme.secondary]
              }
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.createButton}>
              <Text style={styles.createButtonText}>
                Create {type === 'homework' ? 'Homework' : 'Task'}
                {repeat !== 'None' ? ` · ${repeat}` : ''}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.createButton, styles.createButtonDisabled]}>
              <Text style={styles.createButtonTextDisabled}>
                Create {type === 'homework' ? 'Homework' : 'Task'}
              </Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: PANEL_BG,
    flex: 1,
  },
  handleWrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  scrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#EEF2FF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  backChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minWidth: 72,
  },
  backChipText: {
    color: '#7C9CC0',
    fontSize: 13,
    fontWeight: '600',
  },
  presetHint: {
    color: '#7C9CC0',
    fontSize: 13,
    marginBottom: 14,
  },
  presetGrid: {
    gap: 10,
  },
  presetCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  presetTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  presetTitle: {
    color: '#EEF2FF',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  xpBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  presetMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatPill: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  repeatText: {
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: '700',
  },
  roomChip: {
    color: '#7C9CC0',
    fontSize: 12,
    fontWeight: '600',
  },
  proofHint: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '700',
  },
  customEntry: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 14,
  },
  customEntryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeToggle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
    padding: 4,
  },
  typeOption: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  typeLabel: {
    color: '#4B6080',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#7C9CC0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  titleInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#EEF2FF',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  subjectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  subjectEmoji: {
    fontSize: 14,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  proofToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  proofToggleText: {
    color: '#C8D8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  assignDueRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  assignColumn: {
    flex: 1,
  },
  dueColumn: {
    flex: 1,
  },
  dueColumnFull: {
    flex: 1,
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberOuter: {
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 2,
    height: 36,
    width: 36,
  },
  memberInner: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
  },
  memberInnerMuted: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
  },
  memberEmoji: {
    fontSize: 16,
  },
  dueChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dueChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dueChipText: {
    color: '#7C9CC0',
    fontSize: 12,
    fontWeight: '600',
  },
  xpPreview: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  xpPreviewLabel: {
    color: '#7C9CC0',
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },
  xpPreviewValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  xpBolt: {
    fontSize: 18,
  },
  xpAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  xpSuffix: {
    color: '#7C9CC0',
    fontSize: 14,
  },
  createPressable: {
    width: '100%',
  },
  createButton: {
    alignItems: 'center',
    borderRadius: 24,
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  createButtonTextDisabled: {
    color: '#4B6080',
    fontSize: 14,
    fontWeight: '700',
  },
  lockedTitle: {
    color: '#EEF2FF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  lockedBody: {
    color: '#7C9CC0',
    fontSize: 14,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  closeOnly: {
    marginHorizontal: 20,
    paddingVertical: 12,
  },
  closeOnlyText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
});
