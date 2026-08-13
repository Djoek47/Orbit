import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { StreakMarker } from '@/components/orbit/streak-marker';
import { TaskPicker } from '@/components/orbit/task-picker';
import { XpWheel } from '@/components/orbit/xp-wheel';
import Icon from '@/components/orbit/design/Icon';
import type { IconName } from '@/components/orbit/design/icons';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { orbitColors, orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
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
import {
  normalizeRewardSettings,
  resolveTaskXp,
  XP_LADDER,
} from '@/lib/rewards/reward-mode';
import { formatAssigneeLabel } from '@/lib/tasks/split-assign';
import { computeTaskXp, weightForDifficulty } from '@/lib/tasks/xp';
import { allLibraryTasks } from '@/lib/tasks/task-library';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask, TaskDifficulty } from '@/types/orbit';

type TaskType = 'task' | 'homework';
type ScreenMode = 'picker' | 'presets' | 'custom' | 'library';

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
  const isHomework =
    task.domain === 'Homework & Education' || task.domain === 'Homework' || task.group === 'Homework';
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
    // Revision C §1: proof is not a create-time chore flag; homework requires it by default.
    proofRequired: hygiene ? false : isHomework,
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

/** Catalog chips — ChoreMaxx Icon where a domain mark exists; label only otherwise. */
const CATALOG_CHIP_META: Record<string, { icon?: IconName; label: string }> = {
  presets: { label: 'Presets' },
  all: { label: 'All' },
  'Kitchen & Dining': { icon: 'kitchen', label: 'Kitchen' },
  'Trash & Recycling': { icon: 'trash', label: 'Trash' },
  Bathroom: { icon: 'bathroom', label: 'Bathroom' },
  Laundry: { icon: 'laundry', label: 'Laundry' },
  Bedroom: { icon: 'bedroom', label: 'Bedroom' },
  'Living Room & Shared Spaces': { icon: 'livingRoom', label: 'Living' },
  'Floors & Deep Cleaning': { icon: 'floors', label: 'Floors' },
  Pets: { icon: 'pets', label: 'Pets' },
  Car: { icon: 'car', label: 'Car' },
  'Yard & Outdoors': { icon: 'yard', label: 'Yard' },
  Hygiene: { icon: 'hygiene', label: 'Hygiene' },
  'Personal Hygiene': { icon: 'hygiene', label: 'Hygiene' },
  'Daily Routine': { icon: 'dailyRoutine', label: 'Routine' },
  'Homework & Education': { icon: 'homework', label: 'Homework' },
  'Meals, Groceries & Errands': { icon: 'groceries', label: 'Meals' },
  'Home Maintenance & Organization': { icon: 'maintenance', label: 'Home' },
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
  const { orbitPalette } = useOrbit();
  const { c, glass } = useOrbitColors();
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
                <View style={[styles.memberInnerMuted, { backgroundColor: glass(0.08) }]}>
                  <Text style={styles.memberEmoji}>{memberDisplayEmoji(member)}</Text>
                </View>
              )}
              {onShared ? (
                <View
                  style={[
                    styles.sharedDeviceBadge,
                    { borderColor: orbitPalette.backgroundSoft },
                  ]}>
                  <MaterialIcons name="tablet-mac" size={9} color={orbitPalette.text} />
                </View>
              ) : null}
              {selected ? (
                <View style={[styles.splitCheck, { backgroundColor: accent.color }]}>
                  <MaterialIcons name="check" size={10} color={orbitPalette.ink} />
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.assignEmojiName,
                { color: orbitPalette.textMuted },
                selected && { color: accent.color },
              ]}
              numberOfLines={1}>
              {member.name}
            </Text>
          </Pressable>
        );
      })}
      {splitMode ? (
        <Text style={[styles.splitModeHint, { color: c.warning }]}>Split mode · tap more people</Text>
      ) : null}
    </View>
  );
}

export default function CreateTaskScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    tab?: string | string[];
    custom?: string | string[];
    assignee?: string | string[];
    from?: string | string[];
  }>();
  const { accentTheme, createTask, household, orbitPalette, permissions } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const initialTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const customParam = Array.isArray(params.custom) ? params.custom[0] : params.custom;
  const assigneeParam = Array.isArray(params.assignee) ? params.assignee[0] : params.assignee;
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;
  const isCustom = customParam === '1' || customParam === 'true';
  const initialType: TaskType = initialTab === 'homework' ? 'homework' : 'task';

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
  const xpCtx = useMemo(
    () => ({
      mode: rewardSettings.rewardMode,
      hygieneRewarded: rewardSettings.hygieneRewarded,
      hygieneXp: rewardSettings.hygieneXp,
    }),
    [rewardSettings]
  );

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

  const libraryAudience: LibraryAudience = 'family';
  const childMembers = useMemo(
    () => activeMembers.filter(isChildMember),
    [activeMembers],
  );
  /** Hygiene is kids-only — never adult-only homes. */
  const showHygieneLibrary =
    libraryAudience === 'family' && childMembers.length > 0;

  const [mode, setMode] = useState<ScreenMode>(isCustom ? 'custom' : 'picker');
  const [pickerIds, setPickerIds] = useState<string[]>([]);
  const [type, setType] = useState<TaskType>(initialType);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<(typeof subjects)[number]['label']>('Math');
  const defaultAssigneeId = activeMembers[0]?.id ?? '';
  /** Selected assign targets — member ids. Tap = single; long-press = split. */
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultAssigneeId ? [defaultAssigneeId] : []);
  const [splitMode, setSplitMode] = useState(false);
  const [due, setDue] = useState<(typeof dueOptions)[number]>('Today');
  const [priority, setPriority] = useState(1);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (isCustom || initialType === 'homework' || mode !== 'picker') return;
    router.replace({
      pathname: '/assign-task',
      params: {
        ...(assigneeParam ? { member: assigneeParam } : {}),
        ...(fromParam ? { from: fromParam } : {}),
      },
    } as never);
  }, [assigneeParam, fromParam, initialType, isCustom, mode]);
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('medium');
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
        const fallback = labels[kind];
        return {
          kind,
          title: `${fallback.emoji} ${fallback.name}`,
          items: buckets.get(kind) ?? [],
        };
      });
  }, [libraryResults]);

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
  }, [isHygieneDraft, childMembers]);

  // Seed assignee when household members load (picker/custom can mount before roster is ready).
  useEffect(() => {
    if (selectedIds.length > 0) return;
    const named = assigneeParam
      ? (isHygieneDraft ? childMembers : activeMembers).find((m) => m.name === assigneeParam)
      : undefined;
    if (named) {
      setSelectedIds([named.id]);
      return;
    }
    const pool = isHygieneDraft ? childMembers : activeMembers;
    if (pool[0]) setSelectedIds([pool[0].id]);
  }, [activeMembers, assigneeParam, childMembers, isHygieneDraft, selectedIds.length]);

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
        proofRequired: hygiene ? false : Boolean(preset.proofRequired),
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
    setBaseXp(hygiene ? 0 : preset.baseXp);
    const priorityIndex = Math.max(
      0,
      priorities.findIndex((item) => item.difficulty === preset.difficulty),
    );
    setPriority(priorityIndex >= 0 ? priorityIndex : 1);
  }

  if (!permissions.canCreateTask) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: orbitPalette.background,
          },
        ]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.lockedTitle, { color: orbitPalette.text }]}>
          Creating tasks is locked
        </Text>
        <Text style={[styles.lockedBody, { color: orbitPalette.textMuted }]}>
          Your role can complete assigned work, but not create new tasks.
        </Text>
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
          // Revision C §1: homework requires proof by default.
          proofRequired: true,
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
          // Revision C §1: chores never pre-set proof — admins request it after complete.
          proofRequired: false,
          tracking: isHygieneDraft ? 'streak' : 'xp',
        })
      );
    }

    router.back();
  };

  const assignFromPicker = async () => {
    if (!permissions.canAssignTask || pickerIds.length === 0) return;
    if (resolvedAssigneeNames.length === 0) {
      Alert.alert('Pick someone', 'Choose who should do these tasks before assigning.');
      return;
    }
    const library = allLibraryTasks();
    const byId = new Map(library.map((t) => [t.id, t]));
    let createdCount = 0;
    let blocked = false;
    let lastError = '';
    for (const id of pickerIds) {
      const task = byId.get(id);
      if (!task) continue;
      const dueAt = dueAtForFrequency(task.defaultFrequency);
      const occurrenceDate = dueAt ? dueAt.toISOString().slice(0, 10) : undefined;
      const payload = buildTaskPayload({
        title: task.name,
        category: task.domainId,
        due: dueAt ? 'Today' : 'As needed',
        xp: task.xp,
        repeat:
          task.defaultFrequency === 'daily'
            ? 'Daily'
            : task.defaultFrequency === 'weekdays'
              ? 'Weekdays'
              : task.defaultFrequency === 'weekly' || task.defaultFrequency === '2x_weekly'
                ? 'Weekly'
                : 'None',
        difficulty: 'medium',
        weight: 1,
        // Revision C §1: homework proof by default; chores on-demand after complete.
        proofRequired: type === 'homework' || task.domainId === 'homework_education',
        tracking: task.tracking,
      });
      const definitionId = `lib:${task.id}:${payload.assignee}`;
      try {
        if (task.tracking === 'streak') {
          const kids = childMembers.map((m) => m.name);
          if (kids.length === 0) continue;
          const kidNames = payload.assignees?.length
            ? payload.assignees.filter((n) => kids.includes(n))
            : kids.includes(payload.assignee)
              ? [payload.assignee]
              : [kids[0]];
          const created = await createTask({
            ...payload,
            assignee: kidNames[0],
            assignees: kidNames.length > 1 ? kidNames : undefined,
            dueAt: dueAt?.toISOString(),
            baseXp: 0,
            xpEligible: false,
            definitionId: `lib:${task.id}:${kidNames[0]}`,
            occurrenceDate,
          });
          if (created) createdCount += 1;
          else blocked = true;
          continue;
        }
        const created = await createTask({
          ...payload,
          dueAt: dueAt?.toISOString(),
          baseXp: task.xp,
          xpEligible: true,
          definitionId,
          occurrenceDate,
        });
        if (created) createdCount += 1;
        else blocked = true;
      } catch (error) {
        blocked = true;
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (createdCount === 0) {
      Alert.alert(
        'Nothing assigned',
        lastError
          ? `Could not save tasks: ${lastError}`
          : blocked
            ? 'Could not save tasks to the household. Check you are signed in as an admin and try again.'
            : 'No matching tasks were created. Try selecting tasks again.'
      );
      return;
    }

    Alert.alert(
      'Assigned',
      createdCount === 1
        ? `1 task assigned to ${resolvedAssigneeName}.`
        : `${createdCount} tasks assigned to ${resolvedAssigneeName}.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  if (mode === 'picker') {
    if (!isCustom && initialType !== 'homework') {
      return (
        <View style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]} />
      );
    }
    return (
      <View
        style={[
          orbitScreen.container,
          { paddingBottom: insets.bottom, backgroundColor: orbitPalette.background },
        ]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
          <View style={[styles.handle, { backgroundColor: glass(0.2) }]} />
        </View>
        <ScrollView
          style={orbitScreen.container}
          contentContainerStyle={styles.tripContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={orbitScreen.header}>
            <View style={styles.tripNavRow}>
              <Pressable
                onPress={() => router.back()}
                style={[styles.backPill, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
                hitSlop={8}>
                <MaterialIcons name="chevron-left" size={20} color={orbitPalette.text} />
                <Text style={[styles.backPillText, { color: orbitPalette.text }]}>Close</Text>
              </Pressable>
            </View>
            <Text style={[typography.footnote, { color: orbitPalette.textMuted }]}>Create task</Text>
            <Text style={[typography.title1, { color: orbitPalette.text }]}>Assign chores</Text>
            <Text style={[styles.summary, { color: orbitPalette.textMuted }]}>
              Pick who first, then browse domains. {pickerIds.length} selected.
            </Text>
          </View>

          {permissions.canAssignTask ? (
            <GlassCard style={styles.heroCard}>
              <Text style={[styles.poppinsLabel, { color: c.poppinsCyan }]}>WHO&apos;S DOING IT</Text>
              <Text style={[typography.body, { color: orbitPalette.textSoft }]}>
                Tap a person for these tasks. Hold a second profile to split.
              </Text>
              {activeMembers.length === 0 ? (
                <Text style={[typography.footnote, { color: c.warning }]}>
                  No household members yet — add people in Settings, then come back.
                </Text>
              ) : (
                <AssignEmojiGrid
                  members={assigneeChoices}
                  selectedIds={selectedIds}
                  splitMode={splitMode}
                  sharedDeviceIds={sharedDeviceMemberIds}
                  onSelect={selectAssignee}
                  onLongPress={longPressAssignee}
                />
              )}
              {resolvedAssigneeName ? (
                <Text style={[typography.footnote, { color: orbitPalette.textMuted }]}>
                  Assigning to {resolvedAssigneeName}
                  {isSplitAssign ? ' · split XP when each finishes' : ''}
                </Text>
              ) : null}
            </GlassCard>
          ) : (
            <GlassCard style={styles.heroCard}>
              <Text style={[typography.body, { color: orbitPalette.textSoft }]}>
                Only an admin can assign chores. Ask a parent to switch profiles.
              </Text>
            </GlassCard>
          )}

          <TaskPicker
            selectedIds={pickerIds}
            onChange={setPickerIds}
            tab={type === 'homework' ? 'homework' : 'chores'}
            onRequestCustom={() => setMode('custom')}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable onPress={() => setMode('presets')} style={{ flex: 1 }}>
              <Text style={{ color: orbitPalette.textMuted, textAlign: 'center', fontWeight: '600' }}>
                Quick presets
              </Text>
            </Pressable>
            <Pressable onPress={() => setMode('custom')} style={{ flex: 1 }}>
              <Text style={{ color: orbitPalette.textMuted, textAlign: 'center', fontWeight: '600' }}>
                Custom task
              </Text>
            </Pressable>
          </View>
          <OrbitButton
            disabled={
              !permissions.canAssignTask ||
              pickerIds.length === 0 ||
              resolvedAssigneeNames.length === 0
            }
            onPress={() => void assignFromPicker()}>
            Assign {pickerIds.length || ''} task{pickerIds.length === 1 ? '' : 's'}
            {resolvedAssigneeName ? ` · ${resolvedAssigneeName}` : ''}
          </OrbitButton>
        </ScrollView>
      </View>
    );
  }

  if (mode === 'presets') {
    const activeMeta = CATALOG_CHIP_META[catalogChip];
    const pageTitle =
      catalogChip === 'presets'
        ? 'Quick set'
        : catalogChip === 'all'
          ? 'Full library'
          : activeMeta?.label ?? 'Library';
    const pageSummary =
      catalogChip === 'presets'
        ? 'Your household favorites — tap Add to create now.'
        : `${catalogTasks.length} chores · tap Add, or Customize to edit first.`;

    return (
      <View
        style={[
          orbitScreen.container,
          { paddingBottom: insets.bottom, backgroundColor: orbitPalette.background },
        ]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
          <View style={[styles.handle, { backgroundColor: glass(0.2) }]} />
        </View>
        <ScrollView
          style={orbitScreen.container}
          contentContainerStyle={styles.tripContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={orbitScreen.header}>
            <View style={styles.tripNavRow}>
              <Pressable onPress={() => router.back()} style={[styles.backPill, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]} hitSlop={8}>
                <MaterialIcons name="chevron-left" size={20} color={orbitPalette.text} />
                <Text style={[styles.backPillText, { color: orbitPalette.text }]}>Close</Text>
              </Pressable>
            </View>
            <Text style={[typography.footnote, { color: orbitPalette.textMuted }]}>Create task</Text>
            <Text style={[typography.title1, { color: orbitPalette.text }]}>{pageTitle}</Text>
            <Text style={[styles.summary, { color: orbitPalette.textMuted }]}>{pageSummary}</Text>
            <View style={styles.pillRow}>
              <StatusPill
                label={catalogChip === 'presets' ? 'presets' : catalogChip === 'all' ? 'library' : 'category'}
                tone="cyan"
              />
              {catalogChip === 'Hygiene' ? <StatusPill label="kids only" tone="green" /> : null}
              {resolvedAssigneeName ? (
                <StatusPill label={resolvedAssigneeName} tone="blue" />
              ) : null}
            </View>
          </View>

          {permissions.canAssignTask ? (
            <GlassCard style={styles.heroCard}>
              <Text style={[styles.poppinsLabel, { color: c.poppinsCyan }]}>WHO&apos;S DOING IT</Text>
              <Text style={[typography.body, { color: orbitPalette.textSoft }]}>
                Pick one person, or hold a second profile to split the chore.
              </Text>
              <AssignEmojiGrid
                members={assigneeChoices}
                selectedIds={selectedIds}
                splitMode={splitMode}
                sharedDeviceIds={sharedDeviceMemberIds}
                onSelect={selectAssignee}
                onLongPress={longPressAssignee}
              />
              {isSplitAssign ? (
                <Text style={[typography.footnote, { color: orbitPalette.textMuted }]}>
                  Split · {resolvedAssigneeName} — each earns XP when they finish.
                </Text>
              ) : null}
            </GlassCard>
          ) : null}

          <GlassCard style={styles.heroCard}>
            <Text style={[styles.poppinsLabel, { color: c.poppinsCyan }]}>BROWSE</Text>
            <Text style={[typography.body, { color: orbitPalette.textSoft }]}>
              Presets, the full library, or a domain from the Choremaxx catalog.
            </Text>
            <View style={[styles.searchFieldWrap, { backgroundColor: glass(0.04), borderColor: glassBorder(0.1) }]}>
              <MaterialIcons name="search" size={18} color={orbitPalette.textSubtle} />
              <TextInput
                value={presetQuery}
                onChangeText={setPresetQuery}
                placeholder="Search chores…"
                placeholderTextColor={orbitPalette.textFaint}
                style={[styles.searchField, { color: orbitPalette.text }]}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {(
                [
                  { id: 'presets' as const },
                  { id: 'all' as const },
                  ...domains.map((domain) => ({ id: domain })),
                ] as { id: string }[]
              ).map((chip) => {
                const meta = CATALOG_CHIP_META[chip.id] ?? { label: chip.id };
                const active = catalogChip === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => setCatalogChip(chip.id)}
                    style={[
                      styles.filterPill,
                      active && {
                        borderColor: `${accentTheme.primary}88`,
                        backgroundColor: `${accentTheme.primary}22`,
                      },
                    ]}>
                    {meta.icon ? <Icon name={meta.icon} size={20} /> : null}
                    <Text
                      style={[
                        styles.filterPillLabel,
                        { color: c.poppinsCyan },
                        active && { color: accentTheme.primary },
                      ]}>
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.actionRow}>
              {catalogChip === 'presets' ? (
                <OrbitButton tone="secondary" style={styles.flexBtn} onPress={() => setCustomizeQuickOpen(true)}>
                  Customize quick set
                </OrbitButton>
              ) : null}
              <OrbitButton
                style={styles.flexBtn}
                onPress={() => {
                  setMode('custom');
                  setTitle('');
                  setCategory('General');
                  setRepeat('None');
                  setDifficulty('medium');
                  setBaseXp(10);
                  setTracking('xp');
                }}>
                Custom task
              </OrbitButton>
            </View>
          </GlassCard>

          {catalogSections.map((section) => (
            <View key={section.key} style={styles.sectionBlock}>
              {catalogChip !== 'presets' ? (
                <Text style={[styles.sectionLabel, { color: orbitPalette.textSubtle }]}>
                  {section.title}
                  <Text style={[styles.sectionCount, { color: orbitPalette.textFaint }]}>
                    {' '}
                    · {section.items.length}
                  </Text>
                </Text>
              ) : null}
              {section.items.map((preset) => {
                const hygiene = preset.tracking === 'streak' || preset.category === 'Hygiene';
                const xp = resolveTaskXp(
                  { baseXp: preset.baseXp, xpEligible: !hygiene },
                  xpCtx
                );
                const domainIcon =
                  CATALOG_CHIP_META[preset.category ?? '']?.icon ??
                  CATALOG_CHIP_META[preset.domain ?? '']?.icon;
                const metaLine = [
                  preset.group ?? preset.category,
                  preset.repeat !== 'None' ? preset.repeat : null,
                  preset.proofRequired ? 'Proof' : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <GlassCard key={preset.id} style={styles.stopCard}>
                    <View style={styles.stopRow}>
                      <View style={styles.dot}>
                        {domainIcon ? (
                          <Icon name={domainIcon} size={20} />
                        ) : (
                          <Icon name="maintenance" size={20} />
                        )}
                      </View>
                      <View style={styles.stopBody}>
                        <Text style={[typography.headline, { color: orbitPalette.text }]}>
                          {preset.title}
                        </Text>
                        <Text style={[typography.footnote, { color: orbitPalette.textMuted }]}>
                          {metaLine}
                        </Text>
                        <View style={styles.pillRow}>
                          {hygiene ? (
                            <StreakMarker
                              variant="badge"
                              xpWhenRewarded={hygieneXpWhenRewarded}
                            />
                          ) : (
                            <StatusPill label={`+${xp} xp`} tone="cyan" />
                          )}
                          {preset.repeat !== 'None' ? (
                            <StatusPill label={preset.repeat.toLowerCase()} tone="blue" />
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => applyPreset(preset, false)}
                        style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}
                        accessibilityLabel="Customize before creating">
                        <MaterialIcons name="tune" size={20} color={c.textMuted} />
                      </Pressable>
                      <OrbitButton style={styles.flexBtn} onPress={() => applyPreset(preset, true)}>
                        Add task
                      </OrbitButton>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          ))}

          {catalogTasks.length === 0 ? (
            <GlassCard>
              <Text style={[typography.body, { color: orbitPalette.textSoft }]}>
                Nothing matches — try another category.
              </Text>
            </GlassCard>
          ) : null}
        </ScrollView>

        <Modal
          visible={customizeQuickOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setCustomizeQuickOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalSheet,
                {
                  paddingBottom: insets.bottom + 16,
                  backgroundColor: orbitPalette.backgroundSoft,
                },
              ]}>
              <Text style={[typography.title1, { color: orbitPalette.text }]}>Quick presets</Text>
              <Text style={[styles.summary, { color: orbitPalette.textMuted }]}>
                Toggle chores · adjust XP and frequency
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
                    <View key={task.id} style={[styles.libraryRow, { borderBottomColor: glassBorder(0.06) }]}>
                      <Pressable onPress={() => toggleQuickId(task.id)} hitSlop={6}>
                        <MaterialIcons
                          name={on ? 'check-box' : 'check-box-outline-blank'}
                          size={18}
                          color={on ? accentTheme.primary : c.textFaint}
                        />
                      </Pressable>
                      <View style={{ flex: 1, gap: 8 }}>
                        <Pressable onPress={() => toggleQuickId(task.id)}>
                          <Text style={[styles.libraryTitle, { color: orbitPalette.text }]}>
                            {task.title}
                          </Text>
                          <Text style={[styles.libraryMeta, { color: orbitPalette.textMuted }]}>
                            {task.domain}
                          </Text>
                        </Pressable>
                        {on ? (
                          <View style={styles.quickTuneBlock}>
                            <View style={styles.quickXpRow}>
                              <Text style={[styles.quickTuneLabel, { color: c.textSubtle }]}>XP</Text>
                              <Pressable
                                onPress={() =>
                                  updateQuickOverride(task.id, {
                                    baseXp: Math.max(0, xp - 5),
                                  })
                                }
                                style={[styles.quickStepBtn, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
                                <MaterialIcons name="remove" size={16} color={c.textSoft} />
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
                                style={[styles.quickStepBtn, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
                                <MaterialIcons name="add" size={16} color={c.textSoft} />
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
                                      { borderColor: glassBorder(0.12) },
                                      active && {
                                        backgroundColor: `${accentTheme.primary}28`,
                                        borderColor: `${accentTheme.primary}66`,
                                      },
                                    ]}>
                                    <Text
                                      style={[
                                        styles.quickFreqText,
                                        { color: c.textMuted },
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
                          <Text style={[styles.libraryMeta, { color: c.textMuted }]}>
                            {task.baseXp} XP ·{' '}
                            {inferLibraryRepeat(task) === 'None' ? 'Once' : inferLibraryRepeat(task)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <OrbitButton onPress={() => setCustomizeQuickOpen(false)}>Done</OrbitButton>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (mode === 'library') {
    return (
      <View
        style={[
          styles.screen,
          { paddingBottom: insets.bottom, backgroundColor: orbitPalette.background },
        ]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
          <View style={[styles.handle, { backgroundColor: glass(0.2) }]} />
        </View>
        <ScrollView contentContainerStyle={styles.tripContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => setMode('presets')} style={styles.backChip}>
              <MaterialIcons name="chevron-left" size={18} color={orbitPalette.textMuted} />
              <Text style={[styles.backChipText, { color: orbitPalette.textMuted }]}>Quick</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: orbitPalette.text }]}>Task library</Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: glass(0.08) }]}>
              <MaterialIcons color={orbitPalette.textMuted} name="close" size={16} />
            </Pressable>
          </View>
          <TextInput
            value={libraryQuery}
            onChangeText={setLibraryQuery}
            placeholder="Search chores…"
            placeholderTextColor={orbitPalette.textSubtle}
            style={[styles.searchInput, { color: orbitPalette.text, backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetFilterRow}>
            <Pressable
              onPress={() => setLibraryDomain(null)}
              style={[
                styles.presetFilterChip,
                {
                  backgroundColor: !libraryDomain ? `${accentTheme.primary}22` : glass(0.06),
                  borderColor: !libraryDomain ? `${accentTheme.primary}44` : glassBorder(0.08),
                },
              ]}>
              <Text style={[styles.presetFilterText, { color: c.textMuted }, !libraryDomain && { color: accentTheme.primary }]}>
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
                    {
                      backgroundColor: active ? `${accentTheme.primary}22` : glass(0.06),
                      borderColor: active ? `${accentTheme.primary}44` : glassBorder(0.08),
                    },
                  ]}>
                  <Text style={[styles.presetFilterText, { color: c.textMuted }, active && { color: accentTheme.primary }]}>
                    {domain}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.librarySections}>
            {libraryByRoom.map((section) => (
              <View key={section.kind} style={styles.librarySection}>
                <Text style={[styles.librarySectionTitle, { color: orbitPalette.text }]}>
                  {section.title}
                  <Text style={[styles.librarySectionCount, { color: orbitPalette.textSubtle }]}>
                    {' '}
                    · {section.items.length}
                  </Text>
                </Text>
                <View style={styles.presetGrid}>
                  {section.items.map((preset) => {
                    const hygiene = preset.tracking === 'streak' || preset.category === 'Hygiene';
                    const xp = resolveTaskXp(
                      { baseXp: preset.baseXp, xpEligible: !hygiene },
                      xpCtx
                    );
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => applyPreset(preset, true)}
                        onLongPress={() => applyPreset(preset, false)}
                        style={styles.presetCard}>
                        <View style={styles.presetTop}>
                          <Text style={[styles.presetTitle, { color: orbitPalette.text }]}>
                            {preset.title}
                          </Text>
                          {hygiene ? (
                            <StreakMarker
                              variant="asterisk"
                              xpWhenRewarded={hygieneXpWhenRewarded}
                            />
                          ) : (
                            <View style={[styles.xpBadge, { backgroundColor: `${accentTheme.primary}22` }]}>
                              <Text style={[styles.xpBadgeText, { color: accentTheme.primary }]}>
                                +{xp}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.roomChip, { color: c.textMuted }]}>
                          {preset.group ?? preset.category} · hold to customize
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {libraryByRoom.length === 0 ? (
              <Text style={[styles.presetHint, { color: c.textMuted }]}>No chores match this search.</Text>
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
      style={[
        styles.screen,
        { paddingBottom: insets.bottom, backgroundColor: orbitPalette.background },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.handleWrap, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.handle, { backgroundColor: glass(0.2) }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.tripContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => setMode('presets')} style={styles.backChip}>
            <MaterialIcons name="chevron-left" size={18} color={orbitPalette.textMuted} />
            <Text style={[styles.backChipText, { color: orbitPalette.textMuted }]}>Presets</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: orbitPalette.text }]}>Custom task</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: glass(0.08) }]}>
            <MaterialIcons color={orbitPalette.textMuted} name="close" size={16} />
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textMuted }]}>{type === 'homework' ? 'ASSIGNMENT' : 'TASK'}</Text>
          <TextInput
            autoFocus
            onChangeText={setTitle}
            placeholder={type === 'homework' ? 'e.g. Chapter 5 worksheet' : 'e.g. Clean bedroom'}
            placeholderTextColor={orbitPalette.textSubtle}
            style={[styles.titleInput, { color: orbitPalette.text, backgroundColor: glass(0.07), borderColor: glassBorder(0.1) }]}
            value={title}
          />
        </View>

        {type === 'homework' ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.textMuted }]}>SUBJECT</Text>
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
                        backgroundColor: active ? `${item.color}22` : glass(0.06),
                        borderColor: active ? `${item.color}44` : glassBorder(0.08),
                      },
                    ]}>
                    <Text style={styles.subjectEmoji}>{item.emoji}</Text>
                    <Text style={[styles.subjectText, { color: active ? item.color : c.textMuted }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textMuted }]}>REPEAT</Text>
          <View style={styles.subjectRow}>
            {repeatOptions.map((option) => {
              const active = repeat === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setRepeat(option)}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: active ? `${accentTheme.primary}22` : glass(0.06),
                      borderColor: active ? `${accentTheme.primary}44` : glassBorder(0.08),
                    },
                  ]}>
                  <Text style={[styles.subjectText, { color: active ? accentTheme.primary : c.textMuted }]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {permissions.canAssignTask ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.textMuted }]}>
              {isHygieneDraft ? 'ASSIGN TO · kids only' : 'ASSIGN TO · hold to split'}
            </Text>
            {isHygieneDraft ? (
              <Text style={[styles.presetHint, { color: c.textMuted }]}>
                Hygiene builds habits · children only
                {hygieneXpWhenRewarded
                  ? ` · flat ${hygieneXpWhenRewarded} XP when rewarded`
                  : ' · streak, not points'}
              </Text>
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
          <Text style={[styles.label, { color: c.textMuted }]}>DUE</Text>
          <View style={styles.dueChipWrap}>
            {dueOptions.map((option) => {
              const active = due === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setDue(option)}
                  style={[
                    styles.dueChip,
                    { backgroundColor: glass(0.06), borderColor: glassBorder(0.08) },
                    active && {
                      backgroundColor: `${accentTheme.primary}1F`,
                      borderColor: `${accentTheme.primary}59`,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.dueChipText,
                      { color: c.textMuted },
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
            <Text style={[styles.sharedTitlePreview, { color: c.textSoft }]}>Split · {resolvedAssigneeName}</Text>
            <Text style={[styles.sharedPickHint, { color: c.textMuted }]}>
              Each person earns +
              {resolveTaskXp({ baseXp: baseXp || 10, xpEligible: true }, xpCtx)} XP when they finish
              {type === 'homework' ? ' (photo proof required)' : ''}. If everyone finishes, each gets a bonus.
              Admins can penalize anyone who doesn’t.
            </Text>
          </View>
        ) : null}

        {isHygieneDraft ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.textMuted }]}>TRACKING</Text>
            <View style={styles.pillRow}>
              <StreakMarker variant="badge" xpWhenRewarded={hygieneXpWhenRewarded} />
            </View>
            <Text style={[styles.presetHint, { color: c.textMuted }]}>
              Kids hygiene habit · streak tracking
              {hygieneXpWhenRewarded ? ` · flat ${hygieneXpWhenRewarded} XP` : ' · no XP'}
            </Text>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.textMuted }]}>XP · slide the wheel</Text>
            <View style={[styles.xpWheelCard, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]} collapsable={false}>
              <XpWheel
                value={baseXp}
                values={XP_LADDER}
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
          <Text style={[styles.xpPreviewLabel, { color: c.textMuted }]}>
            {isHygieneDraft
              ? `${resolvedAssigneeName || 'Someone'} builds a habit`
              : isSplitAssign
                ? `Each of ${resolvedAssigneeName || 'them'} earns`
                : `${resolvedAssigneeName || 'Someone'} will earn`}
          </Text>
          <View style={styles.xpPreviewValue}>
            {isHygieneDraft ? (
              <StreakMarker variant="asterisk" xpWhenRewarded={hygieneXpWhenRewarded} />
            ) : (
              <>
                <Text style={styles.xpBolt}>⚡</Text>
                <Text style={[styles.xpAmount, { color: accentTheme.primary }]}>
                  +{resolveTaskXp({ baseXp: baseXp || 10, xpEligible: true }, xpCtx)}
                </Text>
                <Text style={[styles.xpSuffix, { color: c.textMuted }]}>XP</Text>
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
            <View style={[styles.createButton, styles.createButtonDisabled, { backgroundColor: glass(0.06) }]}>
              <Text style={[styles.createButtonTextDisabled, { color: c.textSubtle }]}>
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
    flex: 1
  },
  handleWrap: {
    alignItems: 'center',
    paddingBottom: 4
  },
  handle: {
    borderRadius: 999,
    height: 4,
    width: 40
  },
  tripContent: {
    gap: space.md,
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 4
  },
  tripNavRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8
  },
  backPill: {
    alignItems: 'center',
    borderColor: orbitColors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 6
  },
  backPillText: {
    fontSize: 15,
    fontWeight: '600'
  },
  summary: {
    fontSize: 14,
    lineHeight: 20
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  heroCard: {
    gap: 10
  },
  poppinsLabel: {
    color: orbitColors.poppinsCyan,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6
  },
  searchFieldWrap: {
    alignItems: 'center',
    borderColor: orbitColors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  searchField: {
    flex: 1,
    fontSize: 15,
    padding: 0
  },
  filterPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,182,212,0.10)',
    borderColor: 'rgba(6,182,212,0.35)',
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  filterPillEmoji: {
    fontSize: 13,
    lineHeight: 16
  },
  filterPillLabel: {
    color: orbitColors.poppinsCyan,
    fontSize: 12,
    fontWeight: '700'
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: 4
  },
  flexBtn: {
    flexGrow: 1,
    minWidth: 120
  },
  iconBtn: {
    alignItems: 'center',
    borderRadius: radius.control,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  sectionBlock: {
    gap: 12
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingHorizontal: 2
  },
  sectionCount: {
    fontWeight: '600'
  },
  stopCard: {
    gap: space.sm
  },
  stopRow: {
    flexDirection: 'row',
    gap: space.md
  },
  stopBody: {
    flex: 1,
    gap: 6
  },
  dot: {
    alignItems: 'center',
    borderColor: orbitColors.border,
    borderRadius: 14,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  dotEmoji: {
    fontSize: 15,
    lineHeight: 18
  },

  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    marginTop: 4,
    width: 32
  },
  backChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minWidth: 72
  },
  backChipText: {
    fontSize: 13,
    fontWeight: '600'
  },
  presetHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16
  },
  presetAssignBlock: {
    gap: 10,
    marginBottom: 18
  },
  sharedPickBlock: {
    gap: 8,
    marginBottom: 16,
    marginTop: 4
  },
  sharedPickHint: {
    fontSize: 12,
    lineHeight: 17
  },
  sharedTitlePreview: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4
  },
  splitBanner: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.28)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12
  },
  presetFilterRow: {
    gap: 8,
    marginBottom: 14
  },
  presetFilterChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  presetFilterText: {
    fontSize: 12,
    fontWeight: '600'
  },
  presetGrid: {
    gap: 10
  },
  presetCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  presetTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between'
  },
  presetTitleBlock: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0
  },
  presetDomainEmoji: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 1
  },
  presetTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 20
  },
  xpBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  xpBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  presetMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  presetMetaMuted: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500'
  },
  repeatPill: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  repeatText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  roomChip: {
    fontSize: 12,
    fontWeight: '500'
  },
  proofHint: {
    fontSize: 11,
    fontWeight: '600'
  },
  customEntry: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 14
  },
  customEntryText: {
    fontSize: 14,
    fontWeight: '700'
  },
  typeToggle: {
    borderRadius: 16,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
    padding: 4
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
    paddingVertical: 10
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  field: {
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  titleInput: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  subjectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  subjectChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  subjectEmoji: {
    fontSize: 14
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600'
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8
  },
  priorityChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600'
  },
  proofToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  proofToggleText: {
    fontSize: 14,
    fontWeight: '600'
  },
  assignDueRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  assignColumn: {
    flex: 1
  },
  dueColumn: {
    flex: 1
  },
  dueColumnFull: {
    flex: 1
  },
  assignEmojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4
  },
  assignEmojiCell: {
    alignItems: 'center',
    gap: 6,
    width: 64
  },
  assignEmojiName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%'
  },
  splitCheck: {
    alignItems: 'center',
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16
  },
  xpWheelCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  memberOuter: {
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 2,
    height: 36,
    width: 36
  },
  memberInner: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center'
  },
  memberInnerMuted: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center'
  },
  memberEmoji: {
    fontSize: 16
  },
  dueChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  dueChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  dueChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  xpPreview: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  xpPreviewLabel: {
    flex: 1,
    fontSize: 14,
    marginRight: 8
  },
  xpPreviewValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  xpBolt: {
    fontSize: 18
  },
  xpAmount: {
    fontSize: 18,
    fontWeight: '700'
  },
  xpSuffix: {
    fontSize: 14
  },
  createPressable: {
    width: '100%'
  },
  createButton: {
    alignItems: 'center',
    borderRadius: 24,
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%'
  },
  createButtonDisabled: {
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  createButtonTextDisabled: {
    fontSize: 14,
    fontWeight: '700'
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 20
  },
  lockedBody: {
    fontSize: 14,
    marginBottom: 20,
    paddingHorizontal: 20
  },
  closeOnly: {
    marginHorizontal: 20,
    paddingVertical: 12
  },
  closeOnlyText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600'
  },
  assignDeviceCell: {
    minWidth: 96
  },
  deviceCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 4,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 12,
    position: 'relative'
  },
  deviceCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase'
  },
  deviceCardName: {
    fontSize: 12,
    fontWeight: '700'
  },
  splitModeHint: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    width: '100%'
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalSheet: {
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
    gap: 10,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20
  },
  libraryRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12
  },
  libraryTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  libraryMeta: {
    fontSize: 12,
    marginTop: 2
  },
  quickTuneBlock: {
    gap: 8
  },
  quickXpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  quickTuneLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    width: 28
  },
  quickStepBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  quickXpValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center'
  },
  quickFreqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  quickFreqChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  quickFreqText: {
    fontSize: 11,
    fontWeight: '700'
  },
  librarySections: {
    gap: 18
  },
  librarySection: {
    gap: 10
  },
  librarySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  librarySectionCount: {
    fontSize: 13,
    fontWeight: '600'
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  searchWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sharedDeviceBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(14,165,233,0.95)',
    borderRadius: 8,
    borderWidth: 1.5,
    bottom: -2,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 16
  },
  doneBtn: {
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 8,
    paddingVertical: 14
  },
  doneBtnText: {
    color: '#04101F',
    fontSize: 15,
    fontWeight: '800'
  }
});
