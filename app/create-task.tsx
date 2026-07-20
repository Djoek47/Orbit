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

import { XpWheel } from '@/components/orbit/xp-wheel';
import { TASK_PRESETS, type TaskPreset } from '@/data/task-presets';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import {
  isSharedDeviceMember,
  resolveSharedDevicePeople,
  withSharedPersonLabel,
} from '@/lib/household/shared-device';
import { formatAssigneeLabel } from '@/lib/tasks/split-assign';
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

function AssignEmojiGrid({
  members,
  selectedIds,
  onToggle,
}: {
  members: HouseholdMember[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.assignEmojiGrid}>
      {members.map((member) => {
        const accent = memberAccent(member);
        const selected = selectedIds.includes(member.id);
        const gradient = memberGradient(accent.color);
        return (
          <Pressable
            key={member.id}
            accessibilityLabel={
              isSharedDeviceMember(member) ? `${member.name} shared device` : member.name
            }
            onPress={() => onToggle(member.id)}
            style={styles.assignEmojiCell}>
            <View
              style={[
                styles.memberOuter,
                selected && {
                  borderColor: accent.color,
                  shadowColor: accent.color,
                  shadowOpacity: 0.35,
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
              {selected ? (
                <View style={[styles.splitCheck, { backgroundColor: accent.color }]}>
                  <MaterialIcons name="check" size={10} color="#04101F" />
                </View>
              ) : null}
            </View>
            <Text style={[styles.assignEmojiName, selected && { color: accent.color }]} numberOfLines={1}>
              {member.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CreateTaskScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, createTask, household, permissions } = useOrbit();

  const activeMembers = useMemo(
    () => household.members.filter((member) => member.status === 'active'),
    [household.members],
  );

  const rooms = useMemo(() => household.rooms ?? [], [household.rooms]);

  const [mode, setMode] = useState<ScreenMode>('presets');
  const [type, setType] = useState<TaskType>('task');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<(typeof subjects)[number]['label']>('Math');
  const defaultAssigneeId =
    activeMembers.find((member) => !isSharedDeviceMember(member))?.id ?? activeMembers[0]?.id ?? '';
  /** Selected assign targets — member ids. Tap again to multi-select (split). */
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultAssigneeId ? [defaultAssigneeId] : []);
  /** When a shared device is selected, these person ids are who the task/split is for. */
  const [sharedPersonIds, setSharedPersonIds] = useState<string[]>([]);
  const [due, setDue] = useState<(typeof dueOptions)[number]>('Today');
  const [priority, setPriority] = useState(1);
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('medium');
  const [proofRequired, setProofRequired] = useState(false);
  const [roomId, setRoomId] = useState<string | undefined>();
  const [presetRoomFilter, setPresetRoomFilter] = useState<string | 'all' | 'none'>('all');
  const [baseXp, setBaseXp] = useState(10);
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState<string | undefined>();

  const filteredPresets = useMemo(() => {
    if (presetRoomFilter === 'all') return TASK_PRESETS;
    if (presetRoomFilter === 'none') return TASK_PRESETS.filter((preset) => !preset.roomKind);
    const kind = rooms.find((room) => room.id === presetRoomFilter)?.kind;
    if (!kind) return TASK_PRESETS;
    return TASK_PRESETS.filter((preset) => preset.roomKind === kind);
  }, [presetRoomFilter, rooms]);

  const selectedMembers = useMemo(
    () => activeMembers.filter((member) => selectedIds.includes(member.id)),
    [activeMembers, selectedIds],
  );
  const sharedDevice = selectedMembers.find((member) => isSharedDeviceMember(member));
  const needsSharedPerson = Boolean(sharedDevice);
  const sharedPeople = useMemo(
    () => resolveSharedDevicePeople(sharedDevice, household.members),
    [household.members, sharedDevice],
  );
  const sharedSelectedPeople = useMemo(
    () => sharedPeople.filter((member) => sharedPersonIds.includes(member.id)),
    [sharedPeople, sharedPersonIds],
  );

  const resolvedAssigneeNames = useMemo(() => {
    if (!permissions.canAssignTask) {
      return household.greetingName ? [household.greetingName] : [];
    }
    if (needsSharedPerson) {
      return sharedSelectedPeople.map((member) => member.name);
    }
    return selectedMembers
      .filter((member) => !isSharedDeviceMember(member))
      .map((member) => member.name);
  }, [
    household.greetingName,
    needsSharedPerson,
    permissions.canAssignTask,
    selectedMembers,
    sharedSelectedPeople,
  ]);

  const isSplitAssign = resolvedAssigneeNames.length > 1;
  const resolvedAssigneeName = formatAssigneeLabel(resolvedAssigneeNames);

  const displayTitlePreview = (() => {
    if (!title.trim()) return '';
    if (needsSharedPerson && resolvedAssigneeNames.length === 1) {
      return withSharedPersonLabel(title.trim(), resolvedAssigneeNames[0]);
    }
    return title.trim();
  })();

  const weight = weightForDifficulty(type === 'homework' ? 'medium' : difficulty);
  const xpPreview =
    type === 'homework'
      ? computeTaskXp(baseXp || 15, weightForDifficulty('medium'), 'medium')
      : computeTaskXp(baseXp, weight, difficulty);
  const canCreate =
    title.trim().length > 0 &&
    resolvedAssigneeNames.length > 0 &&
    (!needsSharedPerson || sharedSelectedPeople.length > 0);

  function toggleAssignee(memberId: string) {
    const nextMember = activeMembers.find((member) => member.id === memberId);
    if (!nextMember) return;

    if (isSharedDeviceMember(nextMember)) {
      // Shared device is exclusive — selecting it clears other people.
      setSelectedIds([memberId]);
      const people = resolveSharedDevicePeople(nextMember, household.members);
      setSharedPersonIds(people[0] ? [people[0].id] : []);
      return;
    }

    setSelectedIds((current) => {
      const withoutDevices = current.filter((id) => {
        const member = activeMembers.find((item) => item.id === id);
        return member && !isSharedDeviceMember(member);
      });
      if (withoutDevices.includes(memberId)) {
        const next = withoutDevices.filter((id) => id !== memberId);
        return next.length ? next : [memberId];
      }
      return [...withoutDevices, memberId];
    });
    setSharedPersonIds([]);
  }

  function toggleSharedPerson(personId: string) {
    setSharedPersonIds((current) => {
      if (current.includes(personId)) {
        const next = current.filter((id) => id !== personId);
        return next.length ? next : [personId];
      }
      return [...current, personId];
    });
  }

  function roomIdForKind(kind?: TaskPreset['roomKind']) {
    if (!kind) return undefined;
    return rooms.find((room) => room.kind === kind)?.id;
  }

  function buildTaskPayload(base: {
    title: string;
    description?: string;
    category: string;
    due: string;
    xp: number;
    repeat: HouseholdTask['repeat'];
    difficulty: TaskDifficulty;
    weight: number;
    proofRequired: boolean;
    roomId?: string;
  }) {
    const names = resolvedAssigneeNames;
    const singleShared = needsSharedPerson && names.length === 1;
    const finalTitle = singleShared ? withSharedPersonLabel(base.title, names[0]) : base.title;
    return {
      ...base,
      title: finalTitle,
      assignee: names[0] ?? household.greetingName,
      assignees: names.length > 1 ? names : undefined,
      sharedDeviceId: needsSharedPerson ? sharedDevice?.id : undefined,
    };
  }

  function applyPreset(preset: TaskPreset, createNow: boolean) {
    const nextRoomId = roomIdForKind(preset.roomKind);
    const nextXp = computeTaskXp(preset.baseXp, preset.weight, preset.difficulty);

    if (createNow) {
      if (needsSharedPerson && sharedSelectedPeople.length === 0) {
        setMode('custom');
        setTitle(preset.title);
        setCategory(preset.category);
        setDescription(preset.description);
        setRepeat(preset.repeat);
        setDifficulty(preset.difficulty);
        setProofRequired(preset.proofRequired);
        setBaseXp(preset.baseXp);
        setRoomId(nextRoomId);
        return;
      }
      createTask(
        buildTaskPayload({
          title: preset.title,
          description: preset.description,
          category: preset.category,
          due: 'Today',
          xp: nextXp,
          repeat: preset.repeat,
          difficulty: preset.difficulty,
          weight: preset.weight,
          proofRequired: preset.proofRequired,
          roomId: nextRoomId,
        })
      );
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
      createTask(
        buildTaskPayload({
          title: trimmedTitle,
          description: description ?? `Subject: ${subject}`,
          category: 'Homework',
          due,
          xp: computeTaskXp(baseXp || 15, weightForDifficulty('medium'), 'medium'),
          repeat,
          difficulty: 'medium',
          weight: weightForDifficulty('medium'),
          proofRequired,
          roomId,
        })
      );
    } else {
      const selectedPriority = priorities[priority];
      createTask(
        buildTaskPayload({
          title: trimmedTitle,
          description,
          category,
          due,
          xp: computeTaskXp(baseXp || selectedPriority.xp, weight, difficulty),
          repeat,
          difficulty,
          weight,
          proofRequired,
          roomId,
        })
      );
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
          {permissions.canAssignTask ? (
            <View style={styles.presetAssignBlock}>
              <Text style={styles.label}>ASSIGN TO · tap 2+ emojis to split</Text>
              <AssignEmojiGrid
                members={activeMembers}
                selectedIds={selectedIds}
                onToggle={toggleAssignee}
              />
              {isSplitAssign ? (
                <Text style={styles.sharedPickHint}>
                  Split · {resolvedAssigneeName} — each earns XP when they finish; all-done bonus if everyone
                  completes.
                </Text>
              ) : null}
              {needsSharedPerson ? (
                <View style={styles.sharedPickBlock}>
                  <Text style={styles.label}>WHO IS THIS FOR? · tap multiple to split</Text>
                  <Text style={styles.sharedPickHint}>
                    Shared device — pick one or more people. One person → “Task - Name”. Multiple → split shares.
                  </Text>
                  {sharedPeople.length === 0 ? (
                    <Text style={styles.sharedPickHint}>
                      Link people to this device under Manage Members first.
                    </Text>
                  ) : (
                    <View style={styles.subjectRow}>
                      {sharedPeople.map((person) => {
                        const active = sharedPersonIds.includes(person.id);
                        const accent = memberAccent(person);
                        return (
                          <Pressable
                            key={person.id}
                            onPress={() => toggleSharedPerson(person.id)}
                            style={[
                              styles.subjectChip,
                              active && {
                                backgroundColor: `${accent.color}22`,
                                borderColor: `${accent.color}55`,
                              },
                            ]}>
                            <Text style={styles.subjectEmoji}>{memberDisplayEmoji(person)}</Text>
                            <Text style={[styles.subjectText, { color: active ? accent.color : '#7C9CC0' }]}>
                              {person.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          {rooms.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetFilterRow}>
              {(
                [
                  { id: 'all' as const, label: 'All' },
                  { id: 'none' as const, label: 'No room' },
                  ...rooms.map((room) => ({ id: room.id, label: `${room.emoji} ${room.name}` })),
                ] as { id: string; label: string }[]
              ).map((chip) => {
                const active = presetRoomFilter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => setPresetRoomFilter(chip.id as typeof presetRoomFilter)}
                    style={[
                      styles.presetFilterChip,
                      active && {
                        backgroundColor: `${accentTheme.primary}22`,
                        borderColor: `${accentTheme.primary}44`,
                      },
                    ]}>
                    <Text style={[styles.presetFilterText, active && { color: accentTheme.primary }]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={styles.presetGrid}>
            {filteredPresets.map((preset) => {
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
          {filteredPresets.length === 0 ? (
            <Text style={styles.presetHint}>No presets for this room filter.</Text>
          ) : null}

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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
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

        {permissions.canAssignTask ? (
          <View style={styles.field}>
            <Text style={styles.label}>ASSIGN TO · tap 2+ emojis to split</Text>
            <AssignEmojiGrid
              members={activeMembers}
              selectedIds={selectedIds}
              onToggle={toggleAssignee}
            />
          </View>
        ) : null}

        <View style={styles.field}>
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

        {needsSharedPerson ? (
          <View style={styles.sharedPickBlock}>
            <Text style={styles.label}>WHO IS THIS FOR? · multi = split</Text>
            <Text style={styles.sharedPickHint}>
              One person → “Clean dishes - David”. Multiple → split; each proves/finishes for their own XP.
            </Text>
            {sharedPeople.length === 0 ? (
              <Text style={styles.sharedPickHint}>
                Link Emma, David, Liam (or others) to this device in Manage Members.
              </Text>
            ) : (
              <View style={styles.subjectRow}>
                {sharedPeople.map((person) => {
                  const active = sharedPersonIds.includes(person.id);
                  const accent = memberAccent(person);
                  return (
                    <Pressable
                      key={person.id}
                      onPress={() => toggleSharedPerson(person.id)}
                      style={[
                        styles.subjectChip,
                        active && {
                          backgroundColor: `${accent.color}22`,
                          borderColor: `${accent.color}55`,
                        },
                      ]}>
                      <Text style={styles.subjectEmoji}>{memberDisplayEmoji(person)}</Text>
                      <Text style={[styles.subjectText, { color: active ? accent.color : '#7C9CC0' }]}>
                        {person.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {displayTitlePreview && !isSplitAssign ? (
              <Text style={styles.sharedTitlePreview}>Will create: {displayTitlePreview}</Text>
            ) : null}
          </View>
        ) : null}

        {isSplitAssign ? (
          <View style={[styles.sharedPickBlock, styles.splitBanner]}>
            <Text style={styles.sharedTitlePreview}>Split · {resolvedAssigneeName}</Text>
            <Text style={styles.sharedPickHint}>
              Each person earns +{xpPreview} XP when they finish
              {proofRequired ? ' (with proof)' : ''}. If everyone finishes, each gets a bonus. Admins can
              penalize anyone who doesn’t.
            </Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>XP · slide the wheel</Text>
          <View style={styles.xpWheelCard}>
            <XpWheel
              value={baseXp}
              onChange={(next) => {
                setBaseXp(next);
                const match = priorities.findIndex((item) => item.xp === next);
                if (match >= 0) {
                  setPriority(match);
                  setDifficulty(priorities[match].difficulty);
                }
              }}
              accent={type === 'homework' ? '#A78BFA' : accentTheme.primary}
            />
          </View>
        </View>

        <View style={[styles.xpPreview, { borderColor: `${accentTheme.primary}26`, backgroundColor: `${accentTheme.primary}14` }]}>
          <Text style={styles.xpPreviewLabel}>
            {isSplitAssign
              ? `Each of ${resolvedAssigneeName || 'them'} earns`
              : `${resolvedAssigneeName || 'Someone'} will earn`}
          </Text>
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
  presetAssignBlock: {
    gap: 10,
    marginBottom: 16,
  },
  sharedPickBlock: {
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
  },
  sharedPickHint: {
    color: '#7C9CC0',
    fontSize: 12,
    lineHeight: 17,
  },
  sharedTitlePreview: {
    color: '#C8D8F0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  splitBanner: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.28)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  presetFilterRow: {
    gap: 8,
    marginBottom: 14,
  },
  presetFilterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetFilterText: {
    color: '#7C9CC0',
    fontSize: 12,
    fontWeight: '600',
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
  assignEmojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  assignEmojiCell: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  assignEmojiName: {
    color: '#7C9CC0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  splitCheck: {
    alignItems: 'center',
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16,
  },
  xpWheelCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
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
