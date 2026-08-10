/**
 * Revision F §9 — Assign task page.
 * Sticky footer, domain tiles, multi-select — quiet, precise, Apple-calm.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { radius, space, typography } from '@/constants/orbit-theme';
import { choreDomains, type LibraryTask, type TaskDomain } from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

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

function mapLibraryRepeat(
  freq: LibraryTask['defaultFrequency']
): 'None' | 'Daily' | 'Weekly' | 'Weekdays' {
  if (freq === 'daily') return 'Daily';
  if (freq === 'weekdays') return 'Weekdays';
  if (
    freq === 'weekly' ||
    freq === '2x_weekly' ||
    freq === 'biweekly' ||
    freq === 'monthly' ||
    freq === 'quarterly'
  ) {
    return 'Weekly';
  }
  return 'None';
}

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

export default function AssignTaskScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const params = useLocalSearchParams<{ member?: string | string[] }>();
  const memberName = Array.isArray(params.member) ? params.member[0] : params.member;
  const { createTask, household, permissions, v2Permissions, accentTheme } = useOrbit();
  const canAssign = v2Permissions.canAssignOrEditTask || permissions.canCreateTask;
  const isAdmin = permissions.canManageHousehold;

  const assignee =
    household.members.find((m) => m.name === memberName) ??
    household.members.find((m) => m.role === 'child' && m.status === 'active') ??
    household.members.find((m) => m.status === 'active');

  const [search, setSearch] = useState('');
  const [domainId, setDomainId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [busy, setBusy] = useState(false);
  const [freqPickerTaskId, setFreqPickerTaskId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const domains = useMemo(() => choreDomains(), []);
  const domain: TaskDomain | undefined = domains.find((d) => d.id === domainId);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = domain
      ? domain.groups.flatMap((g) => g.tasks)
      : domains.flatMap((d) => d.groups.flatMap((g) => g.tasks));
    if (!q) return pool;
    return pool.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.searchTerms.some((term) => term.toLowerCase().includes(q))
    );
  }, [domain, domains, search]);

  const pickerTask = visibleTasks.find((t) => t.id === freqPickerTaskId);
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
    setSelected((cur) => applyFrequency(cur, freqPickerTaskId, f, visibleTasks));
    setFreqPickerTaskId(null);
  };

  const assign = async () => {
    if (!canAssign || !assignee || selected.length === 0) return;
    setBusy(true);
    try {
      for (const item of selected) {
        await createTask({
          title: item.task.name,
          category: item.task.domainId,
          assignee: assignee.name,
          due: 'Today',
          xp: item.task.xp,
          baseXp: item.task.xp,
          xpEligible: item.task.tracking === 'xp',
          tracking: item.task.tracking,
          repeat: mapLibraryRepeat(item.frequency),
          proofRequired: false,
          definitionId: `lib:${item.task.id}`,
          occurrenceDate: new Date().toISOString().slice(0, 10),
        });
      }
      router.back();
    } catch (error) {
      Alert.alert('Could not assign', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel =
    selected.length === 0
      ? 'Pick some tasks'
      : `Assign ${selected.length} · ${assignee?.name ?? ''}`;

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
        <View style={styles.headerCenter}>
          <Text style={[typography.caption1, { color: c.textMuted, letterSpacing: 0.3 }]}>
            Assigning to
          </Text>
          <Text style={[typography.headline, { color: c.text }]} numberOfLines={1}>
            {assignee?.name ?? '…'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
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
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Domains</Text>
        <View style={styles.tileGrid}>
          {domains.map((d) => {
            const active = domainId === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDomainId(active ? null : d.id)}
                style={[
                  styles.tile,
                  {
                    backgroundColor: active ? `${accentTheme.primary}22` : glass(0.04),
                    borderColor: active ? `${accentTheme.primary}55` : glassBorder(0.08),
                  },
                ]}>
                <Text
                  style={[
                    styles.tileLabel,
                    { color: active ? accentTheme.primary : c.textSoft },
                  ]}
                  numberOfLines={1}>
                  {d.shortName ?? d.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isAdmin ? (
          <Pressable
            onPress={() => router.push('/create-task?custom=1' as never)}
            style={styles.customLink}>
            <Text style={[typography.subheadline, { color: accentTheme.primary, fontWeight: '600' }]}>
              Create custom task
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: space.xl }]}>
          {domain ? domain.name : 'All tasks'}
        </Text>

        <View
          style={[
            styles.listCard,
            { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) },
          ]}>
          {visibleTasks.map((task, index) => {
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
                          const openMore = MORE_FREQS.includes(
                            freq as (typeof MORE_FREQS)[number]
                          );
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
                        <MaterialIcons
                          name="expand-more"
                          size={14}
                          color={accentTheme.primary}
                        />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })}
          {visibleTasks.length === 0 ? (
            <Text style={[typography.body, { color: c.textSubtle, padding: space.xl }]}>
              No tasks match.
            </Text>
          ) : null}
        </View>
      </PersistentScrollView>

      {freqPickerTaskId ? (
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: 'rgba(3,8,16,0.55)' }]}
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
            </Text>
            <Pressable onPress={() => setSelected([])} hitSlop={10}>
              <Text style={[typography.footnote, { color: accentTheme.primary, fontWeight: '600' }]}>
                Clear
              </Text>
            </Pressable>
          </View>
        ) : null}

        {selected.length > 0 ? (
          <View style={styles.chips}>
            {selected.map((s) => (
              <Pressable
                key={s.task.id}
                onPress={() => toggleTask(s.task)}
                style={[styles.chip, { backgroundColor: glass(0.08) }]}>
                <Text style={[typography.caption1, { color: c.textSoft }]} numberOfLines={1}>
                  {s.task.name}
                </Text>
                <MaterialIcons name="close" size={12} color={c.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          disabled={selected.length === 0 || busy || !canAssign}
          onPress={() => void assign()}
          style={[
            styles.assignBtn,
            {
              backgroundColor:
                selected.length === 0 ? glass(0.08) : accentTheme.primary,
              opacity: busy ? 0.65 : 1,
            },
          ]}>
          <Text
            style={[
              typography.headline,
              {
                color: selected.length === 0 ? c.textSubtle : c.ink,
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
  headerCenter: { alignItems: 'center', flex: 1, gap: 2 },
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
    letterSpacing: 0.4,
    marginBottom: space.sm,
    textTransform: 'uppercase',
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tile: {
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: '31%',
    paddingHorizontal: space.sm,
    paddingVertical: 11,
  },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  customLink: {
    alignItems: 'center',
    marginTop: space.md,
    paddingVertical: space.sm,
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
