/**
 * Assign tasks — person first, then tasks.
 * Apple-calm: choose who, pick what, one clear CTA.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import Icon from '@/components/orbit/design/Icon';
import { domainIconName } from '@/components/orbit/design/icon-map';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { choreDomains, type LibraryTask, type TaskDomain } from '@/lib/tasks/task-library';
import { dueLabelForDate, libraryDefinitionId } from '@/lib/tasks/due-label';
import { mapLibraryRepeat } from '@/lib/tasks/library-repeat';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

/** Real people only — shared tablet shells are not assign targets. */
function assignablePeople(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) =>
      member.status === 'active' &&
      member.role !== 'guest' &&
      !isSharedDeviceRole(member.role)
  );
}

type Selected = {
  task: LibraryTask;
  frequency: LibraryTask['defaultFrequency'];
};

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  '2x_weekly': 'Twice a week',
  biweekly: 'Every two weeks',
  quarterly: 'Quarterly',
  seasonal: 'Seasonal',
  as_needed: 'As needed',
  none: 'None',
};

const PRIMARY_FREQS = ['daily', 'weekly', 'monthly'] as const;
const MORE_FREQS = ['weekdays', '2x_weekly', 'biweekly', 'quarterly', 'seasonal', 'as_needed'] as const;

function applyFrequency(
  selected: Selected[],
  taskId: string,
  frequency: LibraryTask['defaultFrequency'],
  pool: LibraryTask[]
): Selected[] {
  const has = selected.some((s) => s.task.id === taskId);
  if (!has) {
    const task = pool.find((x) => x.id === taskId);
    if (!task) return selected;
    return [...selected, { task, frequency }];
  }
  return selected.map((s) => (s.task.id === taskId ? { ...s, frequency } : s));
}

function PersonChip({
  member,
  active,
  onSharedDevice,
  onPress,
}: {
  member: HouseholdMember;
  active: boolean;
  onSharedDevice?: boolean;
  onPress: () => void;
}) {
  const { c, glass } = useOrbitColors();
  const { accentTheme } = useOrbit();
  const photo = isAvatarImageUri(member.avatar);
  const a11y = onSharedDevice
    ? `Assign to ${member.name} on shared device`
    : `Assign to ${member.name}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={a11y}
      style={styles.personChip}>
      <View
        style={[
          styles.personAvatarRing,
          {
            borderColor: active ? accentTheme.primary : 'transparent',
            backgroundColor: active ? `${accentTheme.primary}18` : 'transparent',
          },
        ]}>
        <View style={[styles.personAvatar, { backgroundColor: glass(0.1) }]}>
          {photo ? (
            <Image source={{ uri: member.avatar }} style={styles.personAvatarImage} />
          ) : (
            <Text style={styles.personEmoji}>{memberDisplayEmoji(member)}</Text>
          )}
        </View>
      </View>
      <Text
        style={[
          typography.caption1,
          {
            color: active ? c.text : c.textMuted,
            fontWeight: active ? '700' : '500',
            textAlign: 'center',
          },
        ]}
        numberOfLines={1}>
        {member.name}
      </Text>
    </Pressable>
  );
}

export default function AssignTaskScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const params = useLocalSearchParams<{ member?: string | string[] }>();
  const memberName = Array.isArray(params.member) ? params.member[0] : params.member;
  const { createTask, household, permissions, v2Permissions, accentTheme } = useOrbit();
  const canAssign = v2Permissions.canAssignOrEditTask || permissions.canCreateTask;
  const isAdmin = permissions.canManageHousehold;

  const people = useMemo(() => assignablePeople(household.members), [household.members]);
  const sharedDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const member of people) {
      if (findSharedDeviceForMember(member.id, household.members)) ids.add(member.id);
    }
    return ids;
  }, [people, household.members]);

  const initialId = useMemo(() => {
    const fromParam = people.find((m) => m.name === memberName)?.id;
    if (fromParam) return fromParam;
    return people[0]?.id ?? null;
  }, [people, memberName]);

  const [assigneeId, setAssigneeId] = useState<string | null>(initialId);
  const [search, setSearch] = useState('');
  const [domainSheet, setDomainSheet] = useState<TaskDomain | null>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [busy, setBusy] = useState(false);
  const [freqPickerTaskId, setFreqPickerTaskId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!people.length) {
      if (assigneeId) setAssigneeId(null);
      return;
    }
    if (assigneeId && people.some((m) => m.id === assigneeId)) return;
    setAssigneeId(initialId);
  }, [people, assigneeId, initialId]);

  const assignee = people.find((m) => m.id === assigneeId) ?? null;

  const domains = useMemo(() => choreDomains(), []);
  const allTasks = useMemo(
    () => domains.flatMap((d) => d.groups.flatMap((g) => g.tasks)),
    [domains]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allTasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.searchTerms.some((term) => term.toLowerCase().includes(q))
    );
  }, [allTasks, search]);

  const selectedCountByDomain = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of selected) {
      map.set(item.task.domainId, (map.get(item.task.domainId) ?? 0) + 1);
    }
    return map;
  }, [selected]);

  const sheetTasks = domainSheet?.groups.flatMap((g) => g.tasks) ?? [];

  const pickerTask = allTasks.find((t) => t.id === freqPickerTaskId);
  const pickerCurrent =
    selected.find((s) => s.task.id === freqPickerTaskId)?.frequency ??
    pickerTask?.defaultFrequency;

  const toggleTask = (task: LibraryTask) => {
    setSelected((current) => {
      const exists = current.find((s) => s.task.id === task.id);
      if (exists) return current.filter((s) => s.task.id !== task.id);
      return [...current, { task, frequency: task.defaultFrequency }];
    });
  };

  const chooseFrequency = (f: LibraryTask['defaultFrequency']) => {
    if (!freqPickerTaskId) return;
    setSelected((cur) => applyFrequency(cur, freqPickerTaskId, f, allTasks));
    setFreqPickerTaskId(null);
  };

  const assign = async () => {
    if (!canAssign || !assignee || selected.length === 0) return;
    setBusy(true);
    try {
      for (const item of selected) {
        const dueAt = dueAtForFrequency(item.frequency);
        const occurrenceDate = dueAt ? formatLocalDate(dueAt) : formatLocalDate(new Date());
        await createTask({
          title: item.task.name,
          category: item.task.domainId,
          assignee: assignee.name,
          due: dueLabelForDate(occurrenceDate),
          dueAt: dueAt?.toISOString(),
          xp: item.task.xp,
          baseXp: item.task.xp,
          xpEligible: item.task.tracking === 'xp',
          tracking: item.task.tracking,
          repeat: mapLibraryRepeat(item.frequency),
          proofRequired: false,
          definitionId: libraryDefinitionId(item.task.id, assignee.name),
          occurrenceDate,
        });
      }
      router.back();
    } catch (error) {
      Alert.alert('Could not assign', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const renderTaskCard = (tasks: LibraryTask[]) => (
    <View
      style={[
        styles.listCard,
        { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) },
      ]}>
      {tasks.map((task, index) => {
        const sel = selected.find((s) => s.task.id === task.id);
        const freq = sel?.frequency ?? task.defaultFrequency;
        return (
          <View key={task.id}>
            {index > 0 ? (
              <View style={[styles.hairline, { backgroundColor: glassBorder(0.1) }]} />
            ) : null}
            <Pressable onPress={() => toggleTask(task)} style={styles.row}>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: sel ? accentTheme.primary : c.textFaint,
                    backgroundColor: sel ? accentTheme.primary : 'transparent',
                  },
                ]}>
                {sel ? <MaterialIcons name="check" size={13} color={c.ink} /> : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={[typography.body, { color: c.text, fontWeight: '500' }]}>
                  {task.name}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={[typography.caption1, { color: c.textMuted }]}>
                    {task.xp} XP
                  </Text>
                  <Text style={[typography.caption1, { color: c.textFaint }]}>·</Text>
                  <Pressable
                    onPress={() => {
                      const openMore = MORE_FREQS.includes(freq as (typeof MORE_FREQS)[number]);
                      setMoreOpen(openMore);
                      setFreqPickerTaskId(task.id);
                      if (!sel) toggleTask(task);
                    }}
                    hitSlop={10}
                    style={styles.freqHit}>
                    <Text
                      style={[
                        typography.caption1,
                        { color: accentTheme.primary, fontWeight: '600' },
                      ]}>
                      {FREQ_LABEL[freq] ?? 'Daily'}
                    </Text>
                    <MaterialIcons name="expand-more" size={14} color={accentTheme.primary} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        );
      })}
      {tasks.length === 0 ? (
        <Text style={[typography.body, { color: c.textSubtle, padding: space.xl }]}>
          No tasks match.
        </Text>
      ) : null}
    </View>
  );

  const ctaLabel =
    selected.length === 0
      ? 'Select tasks'
      : !assignee
        ? 'Choose who'
        : selected.length === 1
          ? `Assign to ${assignee.name}`
          : `Assign ${selected.length} to ${assignee.name}`;

  return (
    <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={14}
          style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}
          accessibilityLabel="Close">
          <MaterialIcons name="close" size={20} color={c.textSoft} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text, fontWeight: '700' }]}>Assign</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Who — always choosable (route param only seeds the selection) */}
      <View style={styles.whoBlock}>
        <Text style={[styles.sectionLabel, styles.sectionPad, { color: c.textMuted }]}>Who</Text>
        {people.length === 0 ? (
          <Text style={[typography.footnote, { color: c.textSubtle, paddingHorizontal: space.md }]}>
            Add household members in Settings first.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.peopleRow}>
            {people.map((member) => (
              <PersonChip
                key={member.id}
                member={member}
                active={assigneeId === member.id}
                onSharedDevice={sharedDeviceIds.has(member.id)}
                onPress={() => setAssigneeId(member.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.searchPad}>
        <View
          style={[
            styles.searchField,
            { backgroundColor: glass(0.06), borderColor: glassBorder(0.08) },
          ]}>
          <MaterialIcons name="search" size={18} color={c.textSubtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks"
            placeholderTextColor={c.textSubtle}
            style={[styles.searchInput, { color: c.text }]}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <MaterialIcons name="cancel" size={18} color={c.textSubtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <PersistentScrollView contentContainerStyle={styles.scrollBody}>
        {isAdmin ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/create-task',
                params: {
                  custom: '1',
                  ...(assignee ? { assignee: assignee.name } : {}),
                },
              } as never)
            }
            style={styles.customLink}>
            <Text style={[typography.subheadline, { color: accentTheme.primary, fontWeight: '600' }]}>
              Custom task
            </Text>
          </Pressable>
        ) : null}

        {search.trim() ? (
          <>
            <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: space.sm }]}>
              Tasks
            </Text>
            {renderTaskCard(searchResults)}
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: space.sm }]}>
              Category
            </Text>
            <View style={styles.grid}>
              {domains.map((d) => {
                const count = selectedCountByDomain.get(d.id) ?? 0;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDomainSheet(d)}
                    accessibilityRole="button"
                    accessibilityLabel={d.shortName ?? d.name}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: count ? `${accentTheme.primary}18` : glass(0.06),
                        borderColor: count ? accentTheme.primary : glassBorder(0.1),
                      },
                    ]}>
                    <Icon name={domainIconName(d.id)} size={26} />
                    <Text style={[styles.tileLabel, { color: c.text }]} numberOfLines={1}>
                      {d.shortName ?? d.name}
                    </Text>
                    {count > 0 ? (
                      <View style={[styles.tileBadge, { backgroundColor: accentTheme.primary }]}>
                        <Text style={[styles.tileBadgeText, { color: c.ink }]}>{count}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </PersistentScrollView>

      {domainSheet ? (
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: 'rgba(3,8,16,0.55)', zIndex: 20 }]}
          onPress={() => setDomainSheet(null)}>
          <Pressable
            style={[
              styles.domainSheet,
              {
                backgroundColor: c.backgroundSoft,
                borderColor: glassBorder(0.1),
                paddingBottom: Math.max(insets.bottom, space.md),
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}>
            <View style={[styles.pickerHandle, { backgroundColor: glass(0.18) }]} />
            <View style={styles.sheetHead}>
              <Text style={[typography.title3, { color: c.text }]}>{domainSheet.name}</Text>
              <Pressable onPress={() => setDomainSheet(null)} hitSlop={12} accessibilityLabel="Close">
                <MaterialIcons name="close" size={22} color={c.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ paddingBottom: space.md }}
              keyboardShouldPersistTaps="handled">
              {renderTaskCard(sheetTasks)}
            </ScrollView>
            <Pressable
              onPress={() => setDomainSheet(null)}
              style={[
                styles.doneBtn,
                { backgroundColor: glass(0.1), borderColor: glassBorder(0.12) },
              ]}>
              <Text style={[typography.headline, { color: c.text }]}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}

      {freqPickerTaskId ? (
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: 'rgba(3,8,16,0.55)', zIndex: 40 }]}
          onPress={() => setFreqPickerTaskId(null)}>
          <Pressable
            style={[
              styles.pickerCard,
              { backgroundColor: c.backgroundSoft, borderColor: glassBorder(0.1) },
            ]}
            onPress={(e) => e.stopPropagation?.()}>
            <View style={[styles.pickerHandle, { backgroundColor: glass(0.18) }]} />
            <Text style={[typography.title3, { color: c.text, textAlign: 'center' }]}>
              Frequency
            </Text>
            {pickerTask ? (
              <Text
                style={[
                  typography.footnote,
                  { color: c.textMuted, textAlign: 'center', marginTop: 4 },
                ]}>
                {pickerTask.name}
              </Text>
            ) : null}

            <View style={styles.segment}>
              {PRIMARY_FREQS.map((f) => {
                const active = pickerCurrent === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => chooseFrequency(f)}
                    style={[
                      styles.segmentItem,
                      active && { backgroundColor: `${accentTheme.primary}28` },
                    ]}>
                    <Text
                      style={[
                        styles.segmentText,
                        { color: active ? accentTheme.primary : c.textSoft },
                      ]}>
                      {FREQ_LABEL[f]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setMoreOpen((v) => !v)}
              style={styles.moreToggle}
              hitSlop={8}>
              <Text style={[typography.subheadline, { color: c.textMuted, fontWeight: '600' }]}>
                More
              </Text>
              <MaterialIcons
                name={moreOpen ? 'expand-less' : 'expand-more'}
                size={18}
                color={c.textMuted}
              />
            </Pressable>

            {moreOpen ? (
              <View style={styles.moreList}>
                {MORE_FREQS.map((f) => {
                  const active = pickerCurrent === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => chooseFrequency(f)}
                      style={styles.moreRow}>
                      <Text
                        style={[
                          typography.body,
                          { color: active ? accentTheme.primary : c.textSoft },
                        ]}>
                        {FREQ_LABEL[f]}
                      </Text>
                      {active ? (
                        <MaterialIcons name="check" size={18} color={accentTheme.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, space.md),
            backgroundColor: c.background,
            borderTopColor: glassBorder(0.08),
          },
        ]}>
        {selected.length > 0 ? (
          <View style={styles.footerTop}>
            <Text style={[typography.footnote, { color: c.textMuted }]}>
              {selected.length} selected
              {assignee ? ` · ${assignee.name}` : ''}
            </Text>
            <Pressable onPress={() => setSelected([])} hitSlop={10}>
              <Text style={[typography.footnote, { color: accentTheme.primary, fontWeight: '600' }]}>
                Clear
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          disabled={selected.length === 0 || busy || !canAssign || !assignee}
          onPress={() => void assign()}
          style={[
            styles.assignBtn,
            {
              backgroundColor:
                selected.length === 0 || !assignee ? glass(0.08) : accentTheme.primary,
              opacity: busy ? 0.65 : 1,
            },
          ]}>
          <Text
            style={[
              typography.headline,
              {
                color: selected.length === 0 || !assignee ? c.textSubtle : c.ink,
                fontWeight: '700',
              },
            ]}>
            {ctaLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  iconBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  whoBlock: { gap: space.sm, marginBottom: space.md },
  peopleRow: {
    gap: space.md,
    paddingHorizontal: space.md,
    paddingBottom: 2,
  },
  personChip: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  personAvatarRing: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    padding: 2,
    width: 56,
  },
  personAvatar: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  personAvatarImage: { height: 48, width: 48 },
  personEmoji: { fontSize: 22 },
  searchPad: { paddingHorizontal: space.md, paddingBottom: space.sm },
  searchField: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '400', paddingVertical: 0 },
  scrollBody: { paddingBottom: space.xxl, paddingHorizontal: space.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: space.sm,
    textTransform: 'uppercase',
  },
  sectionPad: { paddingHorizontal: space.md },
  customLink: {
    alignItems: 'center',
    marginBottom: space.xs,
    paddingVertical: space.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    alignItems: 'center',
    aspectRatio: 1,
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    gap: 4,
    justifyContent: 'center',
    maxWidth: '24%',
    minWidth: 72,
    padding: 6,
    width: '22%',
  },
  tileLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  tileBadge: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
    position: 'absolute',
    right: 6,
    top: 6,
  },
  tileBadgeText: { fontSize: 10, fontWeight: '700' },
  domainSheet: {
    borderCurve: 'continuous',
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  sheetHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  sheetScroll: { maxHeight: 420 },
  doneBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.sm,
    paddingVertical: 14,
  },
  listCard: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  check: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 7,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  rowBody: { flex: 1, gap: 3 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  freqHit: { alignItems: 'center', flexDirection: 'row', gap: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  footerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assignBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    paddingVertical: 16,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 30,
  },
  pickerCard: {
    borderCurve: 'continuous',
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: space.section,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
  },
  pickerHandle: {
    alignSelf: 'center',
    borderRadius: radius.full,
    height: 4,
    marginBottom: space.md,
    width: 36,
  },
  segment: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    flexDirection: 'row',
    marginTop: space.xl,
    padding: 3,
  },
  segmentItem: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 10,
  },
  segmentText: { fontSize: 14, fontWeight: '600' },
  moreToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: space.lg,
    paddingVertical: space.xs,
  },
  moreList: { marginTop: space.sm },
  moreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
});
