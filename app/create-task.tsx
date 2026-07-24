import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import {
  CHOREMAXX_TASK_LIBRARY,
  DEFAULT_QUICK_PRESET_IDS,
  filterLibraryTasks,
  inferLibraryRepeat,
  isHygieneLibraryTask,
  libraryDomains,
  type ChoremaxxLibraryTask,
  type LibraryAudience,
  type LibraryTracking,
} from '@/data/choremaxx-task-library';
import { MEMBER_ACCENTS, memberDisplayEmoji } from '@/lib/game-levels';
import { loadQuickPresetConfig, saveQuickPresetConfig, type QuickPresetOverride } from '@/lib/household/local-prefs';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
  withSharedPersonLabel,
} from '@/lib/household/shared-device';
import { formatAssigneeLabel } from '@/lib/tasks/split-assign';
import { computeTaskXp, weightForDifficulty } from '@/lib/tasks/xp';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask, TaskDifficulty } from '@/types/orbit';

type TaskType = 'task' | 'homework';
type ScreenMode = 'presets' | 'custom' | 'library';

export type TaskPreset = {
  id: string;
  title: string;
  category: string;
  baseXp: number;
  difficulty: TaskDifficulty;
  weight: number;
  repeat: HouseholdTask['repeat'];
  proofRequired: boolean;
  description?: string;
  roomKind?: 'kitchen' | 'living' | 'bathroom' | 'bedroom' | 'laundry' | 'outdoor' | 'custom';
  domain?: string;
  group?: string;
  audience?: LibraryAudience;
  tracking?: LibraryTracking;
};

function libraryToPreset(task: ChoremaxxLibraryTask): TaskPreset {
  const hygiene = isHygieneLibraryTask(task);
  const difficulty: TaskDifficulty = hygiene
    ? 'easy'
    : task.baseXp >= 20
      ? 'hard'
      : task.baseXp >= 12
        ? 'medium'
        : 'easy';
  return {
    id: task.id,
    title: task.title,
    category: task.domain,
    baseXp: hygiene ? 0 : task.baseXp,
    difficulty,
    weight: weightForDifficulty(difficulty),
    repeat: inferLibraryRepeat(task),
    proofRequired: hygiene ? false : task.proofDefault,
    roomKind: task.roomKind,
    domain: task.domain,
    group: task.group,
    audience: task.audience,
    tracking: task.tracking,
  };
}

/** People you can assign to — real profiles only (shared tablet shells hidden). */
function assignablePeople(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) =>
      member.status === 'active' &&
      member.role !== 'guest' &&
      !isSharedDeviceRole(member.role),
  );
}

function isChildMember(member: HouseholdMember): boolean {
  return member.role === 'child';
}

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

/** Catalog chips — emoji + short label (filter id stays the full domain). */
const CATALOG_CHIP_META: Record<string, { emoji: string; label: string }> = {
  presets: { emoji: '⚡', label: 'Presets' },
  all: { emoji: '✨', label: 'All' },
  'Kitchen & Dining': { emoji: '🍽️', label: 'Kitchen' },
  'Trash & Recycling': { emoji: '♻️', label: 'Trash' },
  Bathroom: { emoji: '🚿', label: 'Bathroom' },
  Laundry: { emoji: '🧺', label: 'Laundry' },
  Bedroom: { emoji: '🛏️', label: 'Bedroom' },
  'Living Room & Shared Spaces': { emoji: '🛋️', label: 'Living' },
  'Floors & Deep Cleaning': { emoji: '🧹', label: 'Floors' },
  Pets: { emoji: '🐾', label: 'Pets' },
  Car: { emoji: '🚗', label: 'Car' },
  'Yard & Outdoors': { emoji: '🌿', label: 'Yard' },
  Hygiene: { emoji: '🪥', label: 'Hygiene' },
  'Daily Routine': { emoji: '🌅', label: 'Routine' },
  'Homework & Education': { emoji: '📚', label: 'Homework' },
  'Meals, Groceries & Errands': { emoji: '🛒', label: 'Meals' },
  'Home Maintenance & Organization': { emoji: '🧰', label: 'Home' },
};

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
  splitMode,
  sharedDeviceIds,
  onSelect,
  onLongPress,
}: {
  members: HouseholdMember[];
  selectedIds: string[];
  splitMode: boolean;
  /** Member ids that live on a shared tablet — show a small badge. */
  sharedDeviceIds: Set<string>;
  onSelect: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  return (
    <View style={styles.assignEmojiGrid}>
      {members.map((member) => {
        const accent = memberAccent(member);
        const selected = selectedIds.includes(member.id);
        const gradient = memberGradient(accent.color);
        const onShared = sharedDeviceIds.has(member.id);
        return (
          <Pressable
            key={member.id}
            accessibilityLabel={
              onShared ? `${member.name} on shared device` : member.name
            }
            onPress={() => onSelect(member.id)}
            onLongPress={() => onLongPress(member.id)}
            delayLongPress={280}
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
              {onShared ? (
                <View style={styles.sharedDeviceBadge}>
                  <MaterialIcons name="tablet-mac" size={9} color="#EEF2FF" />
                </View>
              ) : null}
              {selected ? (
                <View style={[styles.splitCheck, { backgroundColor: accent.color }]}>
                  <MaterialIcons name="check" size={10} color="#04101F" />
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.assignEmojiName, selected && { color: accent.color }]}
              numberOfLines={1}>
              {member.name}
            </Text>
          </Pressable>
        );
      })}
      {splitMode ? (
        <Text style={styles.splitModeHint}>Split mode · tap more people</Text>
      ) : null}
    </View>
  );
}

export default function CreateTaskScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, createTask, household, permissions } = useOrbit();

  /** Real people only — shared tablet shells are not assign chips. */
  const activeMembers = useMemo(() => assignablePeople(household.members), [household.members]);
  const sharedDeviceMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const member of activeMembers) {
      if (findSharedDeviceForMember(member.id, household.members)) {
        ids.add(member.id);
      }
    }
    return ids;
  }, [activeMembers, household.members]);

  const rooms = useMemo(() => household.rooms ?? [], [household.rooms]);
  const libraryAudience: LibraryAudience =
    household.householdType === 'roommates' ? 'roommate' : 'family';
  const childMembers = useMemo(
    () => activeMembers.filter(isChildMember),
    [activeMembers],
  );
  /** Hygiene is kids-only — never roommates / guests / adult-only homes. */
  const showHygieneLibrary =
    libraryAudience === 'family' && childMembers.length > 0;

  const [mode, setMode] = useState<ScreenMode>('presets');
  const [type, setType] = useState<TaskType>('task');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<(typeof subjects)[number]['label']>('Math');
  const defaultAssigneeId = activeMembers[0]?.id ?? '';
  /** Selected assign targets — member ids. Tap = single; long-press = split. */
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultAssigneeId ? [defaultAssigneeId] : []);
  const [splitMode, setSplitMode] = useState(false);
  const [due, setDue] = useState<(typeof dueOptions)[number]>('Today');
  const [priority, setPriority] = useState(1);
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('medium');
  const [proofRequired, setProofRequired] = useState(false);
  const [roomId, setRoomId] = useState<string | undefined>();
  const [presetQuery, setPresetQuery] = useState('');
  const [baseXp, setBaseXp] = useState(10);
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState<string | undefined>();
  const [tracking, setTracking] = useState<LibraryTracking>('xp');
  const [quickIds, setQuickIds] = useState<string[]>([...DEFAULT_QUICK_PRESET_IDS]);
  const [quickOverrides, setQuickOverrides] = useState<Record<string, QuickPresetOverride>>({});
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryDomain, setLibraryDomain] = useState<string | null>(null);
  const [customizeQuickOpen, setCustomizeQuickOpen] = useState(false);
  /** Create-task catalog chip: quick presets, all library, or one PDF domain. */
  const [catalogChip, setCatalogChip] = useState<'presets' | 'all' | string>('presets');

  useEffect(() => {
    void loadQuickPresetConfig(household.id).then((config) => {
      setQuickIds(config.ids);
      setQuickOverrides(config.overrides);
    });
  }, [household.id]);

  const quickPresets = useMemo(() => {
    const byId = new Map(CHOREMAXX_TASK_LIBRARY.map((task) => [task.id, task]));
    return quickIds
      .map((id) => byId.get(id))
      .filter((task): task is ChoremaxxLibraryTask => Boolean(task))
      .filter((task) => !isHygieneLibraryTask(task))
      .filter((task) => task.audience === 'both' || task.audience === libraryAudience)
      .map((task) => {
        const preset = libraryToPreset(task);
        const override = quickOverrides[task.id];
        if (!override) return preset;
        const baseXp = override.baseXp ?? preset.baseXp;
        const difficulty: TaskDifficulty =
          baseXp >= 20 ? 'hard' : baseXp >= 12 ? 'medium' : 'easy';
        return {
          ...preset,
          baseXp,
          repeat: override.repeat ?? preset.repeat,
          difficulty,
          weight: weightForDifficulty(difficulty),
        };
      });
  }, [quickIds, libraryAudience, quickOverrides]);

  const domains = useMemo(
    () => libraryDomains(libraryAudience, { includeChildOnly: showHygieneLibrary }),
    [libraryAudience, showHygieneLibrary],
  );

  const catalogTasks = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    if (catalogChip === 'presets') {
      let list = quickPresets;
      if (q) {
        list = list.filter((preset) => {
          const hay = `${preset.title} ${preset.category} ${preset.group ?? ''} ${preset.domain ?? ''}`.toLowerCase();
          return hay.includes(q);
        });
      }
      return list;
    }

    const domain = catalogChip === 'all' ? null : catalogChip;
    return filterLibraryTasks({
      audience: libraryAudience,
      domain,
      query: presetQuery,
      includeChildOnly: showHygieneLibrary,
    }).map(libraryToPreset);
  }, [catalogChip, quickPresets, presetQuery, libraryAudience, showHygieneLibrary]);

  /** Group catalog tasks by PDF group under the active category (not for Presets). */
  const catalogSections = useMemo(() => {
    if (catalogChip === 'presets') {
      return [{ key: 'presets', title: 'Your quick set', items: catalogTasks }];
    }
    const buckets = new Map<string, TaskPreset[]>();
    for (const preset of catalogTasks) {
      const key = preset.group ?? preset.category;
      const list = buckets.get(key) ?? [];
      list.push(preset);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries()).map(([title, items]) => ({
      key: title,
      title,
      items,
    }));
  }, [catalogChip, catalogTasks]);

  const libraryResults = useMemo(
    () =>
      filterLibraryTasks({
        audience: libraryAudience,
        domain: libraryDomain,
        query: libraryQuery,
        includeChildOnly: showHygieneLibrary,
      }).map(libraryToPreset),
    [libraryAudience, libraryDomain, libraryQuery, showHygieneLibrary],
  );

  const libraryByRoom = useMemo(() => {
    const order: NonNullable<TaskPreset['roomKind']>[] = [
      'kitchen',
      'living',
      'bathroom',
      'bedroom',
      'laundry',
      'outdoor',
      'custom',
    ];
    const labels: Record<NonNullable<TaskPreset['roomKind']>, { emoji: string; name: string }> = {
      kitchen: { emoji: '🍳', name: 'Kitchen' },
      living: { emoji: '🛋️', name: 'Living room' },
      bathroom: { emoji: '🚿', name: 'Bathroom' },
      bedroom: { emoji: '🛏️', name: 'Bedroom' },
      laundry: { emoji: '🧺', name: 'Laundry' },
      outdoor: { emoji: '🌿', name: 'Outdoor' },
      custom: { emoji: '✨', name: 'General' },
    };
    const buckets = new Map<string, TaskPreset[]>();
    for (const preset of libraryResults) {
      const kind = preset.roomKind ?? 'custom';
      const list = buckets.get(kind) ?? [];
      list.push(preset);
      buckets.set(kind, list);
    }
    return order
      .filter((kind) => (buckets.get(kind)?.length ?? 0) > 0)
      .map((kind) => {
        const householdRoom = rooms.find((room) => room.kind === kind);
        const fallback = labels[kind];
        return {
          kind,
          title: householdRoom
            ? `${householdRoom.emoji} ${householdRoom.name}`
            : `${fallback.emoji} ${fallback.name}`,
          items: buckets.get(kind) ?? [],
        };
      });
  }, [libraryResults, rooms]);

  const isHygieneDraft = tracking === 'streak' || category === 'Hygiene';

  /** Assignees available for the current draft — Hygiene locks to children. */
  const assigneeChoices = useMemo(
    () => (isHygieneDraft ? childMembers : activeMembers),
    [isHygieneDraft, childMembers, activeMembers],
  );

  useEffect(() => {
    if (!isHygieneDraft) return;
    const childIds = new Set(childMembers.map((m) => m.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => childIds.has(id));
      if (next.length > 0) return next;
      return childMembers[0] ? [childMembers[0].id] : [];
    });
    setSplitMode(false);
    setBaseXp(0);
    setProofRequired(false);
  }, [isHygieneDraft, childMembers]);

  const selectedMembers = useMemo(
    () => assigneeChoices.filter((member) => selectedIds.includes(member.id)),
    [assigneeChoices, selectedIds],
  );
  const linkedSharedDeviceId = useMemo(() => {
    for (const member of selectedMembers) {
      const device = findSharedDeviceForMember(member.id, household.members);
      if (device) return device.id;
    }
    return undefined;
  }, [selectedMembers, household.members]);

  const resolvedAssigneeNames = useMemo(() => {
    if (!permissions.canAssignTask) {
      return household.greetingName ? [household.greetingName] : [];
    }
    return selectedMembers.map((member) => member.name);
  }, [household.greetingName, permissions.canAssignTask, selectedMembers]);

  const isSplitAssign = resolvedAssigneeNames.length > 1;
  const resolvedAssigneeName = formatAssigneeLabel(resolvedAssigneeNames);

  const displayTitlePreview = (() => {
    if (!title.trim()) return '';
    if (linkedSharedDeviceId && resolvedAssigneeNames.length === 1) {
      return withSharedPersonLabel(title.trim(), resolvedAssigneeNames[0]);
    }
    return title.trim();
  })();

  const weight = weightForDifficulty(type === 'homework' ? 'medium' : difficulty);
  const xpPreview = isHygieneDraft
    ? 0
    : type === 'homework'
      ? computeTaskXp(baseXp || 15, weightForDifficulty('medium'), 'medium')
      : computeTaskXp(baseXp, weight, difficulty);
  const canCreate =
    title.trim().length > 0 &&
    resolvedAssigneeNames.length > 0 &&
    (!isHygieneDraft || childMembers.length > 0);

  function selectAssignee(memberId: string) {
    if (!assigneeChoices.some((member) => member.id === memberId)) return;

    if (splitMode && !isHygieneDraft) {
      setSelectedIds((current) => {
        if (current.includes(memberId)) {
          const next = current.filter((id) => id !== memberId);
          if (next.length <= 1) setSplitMode(false);
          return next.length ? next : [memberId];
        }
        return [...current, memberId];
      });
      return;
    }

    setSelectedIds([memberId]);
    setSplitMode(false);
  }

  function longPressAssignee(memberId: string) {
    if (isHygieneDraft) {
      selectAssignee(memberId);
      return;
    }
    if (!assigneeChoices.some((member) => member.id === memberId)) return;
    setSplitMode(true);
    setSelectedIds((current) =>
      current.includes(memberId) ? current : [...current, memberId],
    );
  }

    function roomIdForKind(kind?: TaskPreset['roomKind']) {
    if (!kind) return undefined;
    return rooms.find((room) => room.kind === kind)?.id;
  }

  async function persistQuickConfig(nextIds: string[], nextOverrides: Record<string, QuickPresetOverride>) {
    setQuickIds(nextIds);
    setQuickOverrides(nextOverrides);
    await saveQuickPresetConfig(household.id, { ids: nextIds, overrides: nextOverrides });
  }

  function toggleQuickId(id: string) {
    const next = quickIds.includes(id)
      ? quickIds.filter((item) => item !== id)
      : [...quickIds, id];
    const ids = next.length ? next : [...DEFAULT_QUICK_PRESET_IDS];
    const overrides = { ...quickOverrides };
    if (!ids.includes(id)) {
      delete overrides[id];
    }
    void persistQuickConfig(ids, overrides);
  }

  function updateQuickOverride(id: string, patch: QuickPresetOverride) {
    const next = {
      ...quickOverrides,
      [id]: { ...quickOverrides[id], ...patch },
    };
    void persistQuickConfig(quickIds, next);
  }

  function resolvedQuickXp(taskId: string, fallback: number) {
    return quickOverrides[taskId]?.baseXp ?? fallback;
  }

  function resolvedQuickRepeat(taskId: string, fallback: HouseholdTask['repeat']) {
    return quickOverrides[taskId]?.repeat ?? fallback;
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
    tracking?: LibraryTracking;
  }) {
    const hygiene = base.tracking === 'streak' || base.category === 'Hygiene';
    const names = hygiene
      ? (resolvedAssigneeNames.length
          ? resolvedAssigneeNames
          : childMembers.slice(0, 1).map((m) => m.name))
      : resolvedAssigneeNames;
    const singleShared = Boolean(linkedSharedDeviceId) && names.length === 1 && !hygiene;
    const finalTitle = singleShared ? withSharedPersonLabel(base.title, names[0]) : base.title;
    return {
      ...base,
      title: finalTitle,
      xp: hygiene ? 0 : base.xp,
      tracking: hygiene ? ('streak' as const) : base.tracking ?? 'xp',
      proofRequired: hygiene ? false : base.proofRequired,
      assignee: names[0] ?? household.greetingName,
      assignees: names.length > 1 ? names : undefined,
      sharedDeviceId: hygiene ? undefined : linkedSharedDeviceId,
    };
  }

  function applyPreset(preset: TaskPreset, createNow: boolean) {
    const nextRoomId = roomIdForKind(preset.roomKind);
    const hygiene = preset.tracking === 'streak' || preset.category === 'Hygiene';
    const nextXp = hygiene ? 0 : computeTaskXp(preset.baseXp, preset.weight, preset.difficulty);

    if (hygiene) {
      setTracking('streak');
      if (childMembers[0]) {
        setSelectedIds([childMembers[0].id]);
        setSplitMode(false);
      }
    } else {
      setTracking('xp');
    }

    if (createNow) {
      if (hygiene && childMembers.length === 0) return;
      const childNames = childMembers.map((m) => m.name);
      const selectedChildNames = selectedMembers
        .filter(isChildMember)
        .map((m) => m.name);
      const names = hygiene
        ? selectedChildNames.length
          ? selectedChildNames
          : childNames.slice(0, 1)
        : resolvedAssigneeNames;
      createTask({
        title: preset.title,
        description: preset.description,
        category: preset.category,
        due: 'Today',
        xp: nextXp,
        repeat: preset.repeat,
        difficulty: preset.difficulty,
        weight: preset.weight,
        proofRequired: hygiene ? false : preset.proofRequired,
        roomId: nextRoomId,
        tracking: hygiene ? 'streak' : 'xp',
        assignee: names[0] ?? household.greetingName,
        assignees: names.length > 1 ? names : undefined,
        sharedDeviceId: hygiene ? undefined : linkedSharedDeviceId,
      });
      router.back();
      return;
    }

    setMode('custom');
    setType(preset.category === 'Homework' || preset.category === 'Homework & Education' ? 'homework' : 'task');
    setTitle(preset.title);
    setCategory(preset.category);
    setDescription(preset.description);
    setRepeat(preset.repeat);
    setDifficulty(preset.difficulty);
    setProofRequired(hygiene ? false : preset.proofRequired);
    setBaseXp(hygiene ? 0 : preset.baseXp);
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
          xp: isHygieneDraft ? 0 : computeTaskXp(baseXp || selectedPriority.xp, weight, difficulty),
          repeat,
          difficulty: isHygieneDraft ? 'easy' : difficulty,
          weight: isHygieneDraft ? 1 : weight,
          proofRequired: isHygieneDraft ? false : proofRequired,
          roomId,
          tracking: isHygieneDraft ? 'streak' : 'xp',
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
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>NEW TASK</Text>
              <Text style={styles.headerTitle}>Pick something to do</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
              <MaterialIcons color="#7C9CC0" name="close" size={16} />
            </Pressable>
          </View>
          <Text style={styles.presetHint}>
            {catalogChip === 'presets'
              ? 'Quick set · tap to create · hold to edit'
              : 'Library · tap to create · hold to edit'}
          </Text>
          {permissions.canAssignTask ? (
            <View style={styles.presetAssignBlock}>
              <Text style={styles.label}>ASSIGN TO · hold to split</Text>
              <AssignEmojiGrid
                members={activeMembers}
                selectedIds={selectedIds}
                splitMode={splitMode}
                sharedDeviceIds={sharedDeviceMemberIds}
                onSelect={selectAssignee}
                onLongPress={longPressAssignee}
              />
              {isSplitAssign ? (
                <Text style={styles.sharedPickHint}>
                  Split · {resolvedAssigneeName} — each earns XP when they finish; all-done bonus if everyone
                  completes.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={18} color="#6B82A3" />
            <TextInput
              value={presetQuery}
              onChangeText={setPresetQuery}
              placeholder={catalogChip === 'presets' ? 'Search presets…' : 'Search the library…'}
              placeholderTextColor="#4B6080"
              style={styles.searchField}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catalogChipRow}>
            {(
              [
                { id: 'presets' as const },
                { id: 'all' as const },
                ...domains.map((domain) => ({ id: domain })),
              ] as { id: string }[]
            ).map((chip) => {
              const meta = CATALOG_CHIP_META[chip.id] ?? {
                emoji: '•',
                label: chip.id,
              };
              const active = catalogChip === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setCatalogChip(chip.id)}
                  style={[
                    styles.catalogChip,
                    active && {
                      backgroundColor: `${accentTheme.primary}1A`,
                      borderColor: `${accentTheme.primary}66`,
                    },
                  ]}>
                  <Text style={styles.catalogChipEmoji}>{meta.emoji}</Text>
                  <Text
                    style={[
                      styles.catalogChipLabel,
                      active && { color: accentTheme.primary },
                    ]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.catalogBody}>
            {catalogSections.map((section) => {
              const sectionEmoji =
                catalogChip !== 'presets' && catalogChip !== 'all'
                  ? CATALOG_CHIP_META[catalogChip]?.emoji
                  : catalogChip === 'presets'
                    ? '⚡'
                    : undefined;
              return (
                <View key={section.key} style={styles.catalogSection}>
                  {catalogChip !== 'presets' ? (
                    <View style={styles.catalogSectionHead}>
                      {sectionEmoji && catalogChip !== 'all' ? (
                        <Text style={styles.catalogSectionEmoji}>{sectionEmoji}</Text>
                      ) : null}
                      <Text style={styles.catalogSectionTitle}>{section.title}</Text>
                      <Text style={styles.catalogSectionCount}>{section.items.length}</Text>
                    </View>
                  ) : null}
                  <View style={styles.presetGrid}>
                    {section.items.map((preset) => {
                      const hygiene = preset.tracking === 'streak' || preset.category === 'Hygiene';
                      const xp = hygiene
                        ? 0
                        : computeTaskXp(preset.baseXp, preset.weight, preset.difficulty);
                      const domainEmoji =
                        CATALOG_CHIP_META[preset.category ?? '']?.emoji ??
                        CATALOG_CHIP_META[preset.domain ?? '']?.emoji;
                      return (
                        <Pressable
                          key={preset.id}
                          onPress={() => applyPreset(preset, true)}
                          onLongPress={() => applyPreset(preset, false)}
                          style={styles.presetCard}>
                          <View style={styles.presetTop}>
                            <View style={styles.presetTitleBlock}>
                              {domainEmoji ? (
                                <Text style={styles.presetDomainEmoji}>{domainEmoji}</Text>
                              ) : null}
                              <Text style={styles.presetTitle} numberOfLines={2}>
                                {preset.title}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.xpBadge,
                                {
                                  backgroundColor: hygiene
                                    ? 'rgba(52,211,153,0.14)'
                                    : `${accentTheme.primary}18`,
                                },
                              ]}>
                              <Text
                                style={[
                                  styles.xpBadgeText,
                                  { color: hygiene ? '#34D399' : accentTheme.primary },
                                ]}>
                                {hygiene ? 'Streak' : `+${xp}`}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.presetMetaRow}>
                            {preset.repeat !== 'None' ? (
                              <View style={styles.repeatPill}>
                                <Text style={styles.repeatText}>{preset.repeat}</Text>
                              </View>
                            ) : null}
                            <Text style={styles.presetMetaMuted} numberOfLines={1}>
                              {preset.group ?? preset.category}
                            </Text>
                          </View>
                          {preset.proofRequired ? (
                            <Text style={styles.proofHint}>Photo proof</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            {catalogTasks.length === 0 ? (
              <Text style={styles.presetHint}>Nothing matches — try another category.</Text>
            ) : null}
          </View>

          {catalogChip === 'presets' ? (
            <Pressable onPress={() => setCustomizeQuickOpen(true)} style={styles.customEntry}>
              <MaterialIcons name="tune" size={16} color="#7C9CC0" />
              <Text style={[styles.customEntryText, { color: '#7C9CC0' }]}>Customize quick set</Text>
            </Pressable>
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
              setTracking('xp');
              setRoomId(undefined);
            }}
            style={styles.customEntry}>
            <MaterialIcons name="edit" size={16} color={accentTheme.primary} />
            <Text style={[styles.customEntryText, { color: accentTheme.primary }]}>Custom task</Text>
          </Pressable>
        </ScrollView>

        <Modal visible={customizeQuickOpen} animationType="slide" transparent onRequestClose={() => setCustomizeQuickOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.headerTitle}>Quick presets</Text>
              <Text style={styles.presetHint}>
                Toggle chores · adjust XP and frequency for your quick set
              </Text>
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {filterLibraryTasks({
                  audience: libraryAudience,
                  includeChildOnly: false,
                }).map((task) => {
                  if (isHygieneLibraryTask(task)) return null;
                  const on = quickIds.includes(task.id);
                  const xp = resolvedQuickXp(task.id, task.baseXp);
                  const freq = resolvedQuickRepeat(task.id, inferLibraryRepeat(task));
                  return (
                    <View key={task.id} style={styles.libraryRow}>
                      <Pressable onPress={() => toggleQuickId(task.id)} hitSlop={6}>
                        <MaterialIcons
                          name={on ? 'check-box' : 'check-box-outline-blank'}
                          size={18}
                          color={on ? accentTheme.primary : '#4B6080'}
                        />
                      </Pressable>
                      <View style={{ flex: 1, gap: 8 }}>
                        <Pressable onPress={() => toggleQuickId(task.id)}>
                          <Text style={styles.libraryTitle}>{task.title}</Text>
                          <Text style={styles.libraryMeta}>{task.domain}</Text>
                        </Pressable>
                        {on ? (
                          <View style={styles.quickTuneBlock}>
                            <View style={styles.quickXpRow}>
                              <Text style={styles.quickTuneLabel}>XP</Text>
                              <Pressable
                                onPress={() =>
                                  updateQuickOverride(task.id, {
                                    baseXp: Math.max(5, xp - 5),
                                  })
                                }
                                style={styles.quickStepBtn}>
                                <MaterialIcons name="remove" size={16} color="#C8D8F0" />
                              </Pressable>
                              <Text style={[styles.quickXpValue, { color: accentTheme.primary }]}>
                                {xp}
                              </Text>
                              <Pressable
                                onPress={() =>
                                  updateQuickOverride(task.id, {
                                    baseXp: Math.min(100, xp + 5),
                                  })
                                }
                                style={styles.quickStepBtn}>
                                <MaterialIcons name="add" size={16} color="#C8D8F0" />
                              </Pressable>
                            </View>
                            <View style={styles.quickFreqRow}>
                              {(['None', 'Daily', 'Weekly', 'Weekdays'] as const).map((option) => {
                                const active = freq === option;
                                return (
                                  <Pressable
                                    key={option}
                                    onPress={() => updateQuickOverride(task.id, { repeat: option })}
                                    style={[
                                      styles.quickFreqChip,
                                      active && {
                                        backgroundColor: `${accentTheme.primary}28`,
                                        borderColor: `${accentTheme.primary}66`,
                                      },
                                    ]}>
                                    <Text
                                      style={[
                                        styles.quickFreqText,
                                        active && { color: accentTheme.primary },
                                      ]}>
                                      {option === 'None' ? 'Once' : option}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.libraryMeta}>
                            {task.baseXp} XP · {inferLibraryRepeat(task) === 'None' ? 'Once' : inferLibraryRepeat(task)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => setCustomizeQuickOpen(false)}
                style={[styles.doneBtn, { backgroundColor: accentTheme.primary }]}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (mode === 'library') {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.handle} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => setMode('presets')} style={styles.backChip}>
              <MaterialIcons name="chevron-left" size={18} color="#7C9CC0" />
              <Text style={styles.backChipText}>Quick</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Task library</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
              <MaterialIcons color="#7C9CC0" name="close" size={16} />
            </Pressable>
          </View>
          <TextInput
            value={libraryQuery}
            onChangeText={setLibraryQuery}
            placeholder="Search chores…"
            placeholderTextColor="#4B6080"
            style={styles.searchInput}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetFilterRow}>
            <Pressable
              onPress={() => setLibraryDomain(null)}
              style={[
                styles.presetFilterChip,
                !libraryDomain && {
                  backgroundColor: `${accentTheme.primary}22`,
                  borderColor: `${accentTheme.primary}44`,
                },
              ]}>
              <Text style={[styles.presetFilterText, !libraryDomain && { color: accentTheme.primary }]}>
                All
              </Text>
            </Pressable>
            {domains.map((domain) => {
              const active = libraryDomain === domain;
              return (
                <Pressable
                  key={domain}
                  onPress={() => setLibraryDomain(domain)}
                  style={[
                    styles.presetFilterChip,
                    active && {
                      backgroundColor: `${accentTheme.primary}22`,
                      borderColor: `${accentTheme.primary}44`,
                    },
                  ]}>
                  <Text style={[styles.presetFilterText, active && { color: accentTheme.primary }]}>
                    {domain}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.librarySections}>
            {libraryByRoom.map((section) => (
              <View key={section.kind} style={styles.librarySection}>
                <Text style={styles.librarySectionTitle}>
                  {section.title}
                  <Text style={styles.librarySectionCount}> · {section.items.length}</Text>
                </Text>
                <View style={styles.presetGrid}>
                  {section.items.map((preset) => {
                    const hygiene = preset.tracking === 'streak' || preset.category === 'Hygiene';
                    const xp = hygiene ? 0 : computeTaskXp(preset.baseXp, preset.weight, preset.difficulty);
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => applyPreset(preset, true)}
                        onLongPress={() => applyPreset(preset, false)}
                        style={styles.presetCard}>
                        <View style={styles.presetTop}>
                          <Text style={styles.presetTitle}>{preset.title}</Text>
                          <View style={[styles.xpBadge, { backgroundColor: `${accentTheme.primary}22` }]}>
                            <Text style={[styles.xpBadgeText, { color: accentTheme.primary }]}>
                              {hygiene ? 'Streak' : `+${xp}`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.roomChip}>
                          {preset.group ?? preset.category} · hold to customize
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {libraryByRoom.length === 0 ? (
              <Text style={styles.presetHint}>No chores match this search.</Text>
            ) : null}
          </View>
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

        {!isHygieneDraft ? (
          <Pressable onPress={() => setProofRequired((value) => !value)} style={styles.proofToggle}>
            <MaterialIcons
              name={proofRequired ? 'check-box' : 'check-box-outline-blank'}
              size={18}
              color={proofRequired ? accentTheme.primary : '#4B6080'}
            />
            <Text style={styles.proofToggleText}>Require photo proof</Text>
          </Pressable>
        ) : null}

        {permissions.canAssignTask ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {isHygieneDraft ? 'ASSIGN TO · kids only' : 'ASSIGN TO · hold to split'}
            </Text>
            {isHygieneDraft ? (
              <Text style={styles.presetHint}>Hygiene builds habits — no XP · children only</Text>
            ) : null}
            <AssignEmojiGrid
              members={assigneeChoices}
              selectedIds={selectedIds}
              splitMode={splitMode}
              sharedDeviceIds={sharedDeviceMemberIds}
              onSelect={selectAssignee}
              onLongPress={longPressAssignee}
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

        {isHygieneDraft ? (
          <View style={styles.field}>
            <Text style={styles.label}>TRACKING</Text>
            <Text style={styles.presetHint}>Kids hygiene habit · streak only · 0 XP</Text>
          </View>
        ) : (
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
        )}

        <View style={[styles.xpPreview, { borderColor: `${accentTheme.primary}26`, backgroundColor: `${accentTheme.primary}14` }]}>
          <Text style={styles.xpPreviewLabel}>
            {isHygieneDraft
              ? `${resolvedAssigneeName || 'Someone'} builds a habit`
              : isSplitAssign
                ? `Each of ${resolvedAssigneeName || 'them'} earns`
                : `${resolvedAssigneeName || 'Someone'} will earn`}
          </Text>
          <View style={styles.xpPreviewValue}>
            {isHygieneDraft ? (
              <Text style={[styles.xpAmount, { color: accentTheme.primary }]}>Streak</Text>
            ) : (
              <>
                <Text style={styles.xpBolt}>⚡</Text>
                <Text style={[styles.xpAmount, { color: accentTheme.primary }]}>+{xpPreview}</Text>
                <Text style={styles.xpSuffix}>XP</Text>
              </>
            )}
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  headerEyebrow: {
    color: '#6B82A3',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: '#EEF2FF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    marginTop: 4,
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
    color: '#6B82A3',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  presetAssignBlock: {
    gap: 10,
    marginBottom: 18,
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
  catalogChipRow: {
    gap: 8,
    marginBottom: 18,
    marginTop: 12,
    paddingRight: 8,
  },
  catalogChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  catalogChipEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  catalogChipLabel: {
    color: '#9BB0CC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  catalogBody: {
    gap: 22,
  },
  catalogSection: {
    gap: 10,
  },
  catalogSectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  catalogSectionEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  catalogSectionTitle: {
    color: '#C8D8F0',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  catalogSectionCount: {
    color: '#4B6080',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  presetFilterRow: {
    gap: 8,
    marginBottom: 14,
  },
  presetFilterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
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
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  presetTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  presetTitleBlock: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  presetDomainEmoji: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 1,
  },
  presetTitle: {
    color: '#EEF2FF',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  xpBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  xpBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  presetMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetMetaMuted: {
    color: '#5A7190',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  repeatPill: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  repeatText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  roomChip: {
    color: '#5A7190',
    fontSize: 12,
    fontWeight: '500',
  },
  proofHint: {
    color: '#7C9CC0',
    fontSize: 11,
    fontWeight: '600',
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
  assignDeviceCell: {
    minWidth: 96,
  },
  deviceCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 4,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 12,
    position: 'relative',
  },
  deviceCardLabel: {
    color: '#7C9CC0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  deviceCardName: {
    color: '#C8D8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  splitModeHint: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    width: '100%',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: PANEL_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 10,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  libraryRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  libraryTitle: {
    color: '#EEF2FF',
    fontSize: 14,
    fontWeight: '600',
  },
  libraryMeta: {
    color: '#7C9CC0',
    fontSize: 12,
    marginTop: 2,
  },
  quickTuneBlock: {
    gap: 8,
  },
  quickXpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  quickTuneLabel: {
    color: '#4B6080',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    width: 28,
  },
  quickStepBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  quickXpValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  quickFreqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickFreqChip: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickFreqText: {
    color: '#7C9CC0',
    fontSize: 11,
    fontWeight: '700',
  },
  librarySections: {
    gap: 18,
  },
  librarySection: {
    gap: 10,
  },
  librarySectionTitle: {
    color: '#EEF2FF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  librarySectionCount: {
    color: '#4B6080',
    fontSize: 13,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#EEF2FF',
    fontSize: 15,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchField: {
    color: '#EEF2FF',
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  sharedDeviceBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(14,165,233,0.95)',
    borderColor: '#0A1525',
    borderRadius: 8,
    borderWidth: 1.5,
    bottom: -2,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 16,
  },
  doneBtn: {
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 8,
    paddingVertical: 14,
  },
  doneBtnText: {
    color: '#04101F',
    fontSize: 15,
    fontWeight: '800',
  },
});
