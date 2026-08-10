/**
 * Revision F §9 — Assign task page (sticky footer, domain tiles, multi-select).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
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

function mapLibraryRepeat(freq: LibraryTask['defaultFrequency']): 'None' | 'Daily' | 'Weekly' | 'Weekdays' {
  if (freq === 'daily') return 'Daily';
  if (freq === 'weekdays') return 'Weekdays';
  if (freq === 'weekly' || freq === '2x_weekly' || freq === 'biweekly') return 'Weekly';
  return 'None';
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

  const toggleTask = (task: LibraryTask) => {
    setSelected((current) => {
      const exists = current.find((s) => s.task.id === task.id);
      if (exists) return current.filter((s) => s.task.id !== task.id);
      return [...current, { task, frequency: task.defaultFrequency }];
    });
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

  const label =
    selected.length === 0
      ? 'Pick some tasks'
      : `Assign ${selected.length} task${selected.length === 1 ? '' : 's'} · ${assignee?.name ?? ''}`;

  return (
    <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: glassBorder(0.1) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="close" size={22} color={c.text} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text }]}>
          Assigning to {assignee?.name ?? '…'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color={c.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks…"
          placeholderTextColor={c.textSubtle}
          style={[styles.searchInput, { color: c.text }]}
        />
      </View>

      <PersistentScrollView contentContainerStyle={styles.scrollBody}>
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
                    backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                    borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                  },
                ]}>
                <Text
                  style={[styles.tileLabel, { color: active ? accentTheme.primary : c.textSoft }]}
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
            style={[
              styles.customBtn,
              { borderColor: glassBorder(0.14), backgroundColor: glass(0.04) },
            ]}>
            <Text style={[typography.subheadline, { color: c.textSubtle, fontWeight: '600' }]}>
              Create custom task
            </Text>
          </Pressable>
        ) : null}

        {visibleTasks.map((task) => {
          const sel = selected.find((s) => s.task.id === task.id);
          return (
            <Pressable
              key={task.id}
              onPress={() => toggleTask(task)}
              style={[styles.row, { borderBottomColor: glassBorder(0.08) }]}>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: sel ? accentTheme.primary : c.textSubtle,
                    backgroundColor: sel ? accentTheme.primary : 'transparent',
                  },
                ]}>
                {sel ? <MaterialIcons name="check" size={12} color={orbitColors.ink} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: c.text }]}>{task.name}</Text>
                <Text style={[typography.caption1, { color: c.textSubtle }]}>
                  {task.xp} XP · {FREQ_LABEL[sel?.frequency ?? task.defaultFrequency] ?? 'Daily'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </PersistentScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopColor: glassBorder(0.12),
            backgroundColor: c.background,
          },
        ]}>
        <View style={styles.footerMeta}>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            Selected: {selected.length} task{selected.length === 1 ? '' : 's'}
          </Text>
          {selected.length > 0 ? (
            <Pressable onPress={() => setSelected([])}>
              <Text style={[typography.footnote, { color: accentTheme.primary }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.chips}>
          {selected.map((s) => (
            <Pressable
              key={s.task.id}
              onPress={() => toggleTask(s.task)}
              style={[styles.chip, { backgroundColor: `${accentTheme.primary}22` }]}>
              <Text style={[typography.caption1, { color: accentTheme.primary }]}>
                {s.task.name} ×
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          disabled={selected.length === 0 || busy || !canAssign}
          onPress={() => void assign()}
          style={[
            styles.assignBtn,
            {
              backgroundColor:
                selected.length === 0 ? glass(0.08) : accentTheme.primary,
              opacity: busy ? 0.7 : 1,
            },
          ]}>
          <Text
            style={[
              typography.headline,
              {
                color: selected.length === 0 ? c.textSubtle : orbitColors.ink,
              },
            ]}>
            {label}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  searchWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 6 },
  scrollBody: { paddingBottom: 24, paddingHorizontal: space.md },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tile: {
    borderRadius: radius.control,
    borderWidth: 1,
    minWidth: '30%',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  customBtn: {
    alignItems: 'center',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginBottom: 12,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  check: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: space.md,
    paddingTop: 10,
  },
  footerMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  assignBtn: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
});
