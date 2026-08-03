/**
 * Shared task picker — search + 14 chore domain tiles (§4).
 * Reused by onboarding Step B and Tasks add-task flow.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  choreDomains,
  homeworkDomain,
  type LibraryTask,
  type TaskDomain,
  type TaskGroup,
} from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type TaskPickerTab = 'chores' | 'homework';

type TaskPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** chores = 14 domain tiles; homework = groups only (§4.6). */
  tab?: TaskPickerTab;
  onRequestCustom?: (query: string) => void;
};

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = a[i] === b[j] ? row[j] : Math.min(row[j], row[j + 1], prev) + 1;
      row[j] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function rankMatch(task: LibraryTask, query: string): number | null {
  const q = normalize(query);
  if (!q) return null;
  const name = normalize(task.name);
  const terms = task.searchTerms.map(normalize);
  if (name.startsWith(q)) return 0;
  if (name.split(/\s+/).some((t) => t.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  if (terms.some((t) => t.includes(q) || t.startsWith(q))) return 3;
  if (q.length >= 5) {
    const tokens = [name, ...terms, ...name.split(/\s+/)];
    if (tokens.some((t) => t.length >= 5 && levenshtein(t, q) <= 1)) return 4;
  }
  return null;
}

export function TaskPicker({
  selectedIds,
  onChange,
  tab = 'chores',
  onRequestCustom,
}: TaskPickerProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const [query, setQuery] = useState('');
  const [domainSheet, setDomainSheet] = useState<TaskDomain | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const domains = useMemo(() => (tab === 'homework' ? [] : choreDomains()), [tab]);
  const homework = useMemo(() => homeworkDomain(), []);
  const searchable = useMemo(() => {
    if (tab === 'homework') {
      return homework?.groups.flatMap((g) => g.tasks) ?? [];
    }
    return domains.flatMap((d) => d.groups.flatMap((g) => g.tasks));
  }, [domains, homework, tab]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchable
      .map((task) => ({ task, rank: rankMatch(task, query.trim()) }))
      .filter((row): row is { task: LibraryTask; rank: number } => row.rank != null)
      .sort((a, b) => a.rank - b.rank || a.task.name.localeCompare(b.task.name))
      .map((row) => row.task);
  }, [query, searchable]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectGroup = (group: TaskGroup) => {
    const ids = group.tasks.map((t) => t.id);
    const next = new Set(selectedIds);
    const allSelected = ids.every((id) => next.has(id));
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    onChange([...next]);
  };

  const selectedTasks = searchable.filter((t) => selectedSet.has(t.id));

  const openDomain = (domain: TaskDomain) => {
    setDomainSheet(domain);
    const open: Record<string, boolean> = {};
    domain.groups.forEach((g, i) => {
      open[g.id] = i === 0;
    });
    setExpandedGroups(open);
  };

  const renderGroupList = (groups: TaskGroup[]) =>
    groups.map((group) => {
      const expanded = expandedGroups[group.id] ?? false;
      const allOn = group.tasks.every((t) => selectedSet.has(t.id));
      return (
        <View key={group.id} style={styles.groupBlock}>
          <View style={styles.groupHeader}>
            <Pressable
              onPress={() =>
                setExpandedGroups((cur) => ({ ...cur, [group.id]: !expanded }))
              }
              style={styles.groupTitleHit}>
              <MaterialIcons
                name={expanded ? 'expand-more' : 'chevron-right'}
                size={20}
                color={c.textMuted}
              />
              <Text style={[styles.groupTitle, { color: c.text }]}>{group.name}</Text>
            </Pressable>
            <Pressable onPress={() => selectGroup(group)} hitSlop={8}>
              <Text style={[styles.selectAll, { color: c.textSoft }]}>
                {allOn ? 'Clear' : 'Select all'}
              </Text>
            </Pressable>
          </View>
          {expanded
            ? group.tasks.map((task) => {
                const on = selectedSet.has(task.id);
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => toggle(task.id)}
                    style={[styles.taskRow, { borderBottomColor: glassBorder(0.08) }]}>
                    <MaterialIcons
                      name={on ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={on ? c.textSoft : c.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskName, { color: c.text }]}>{task.name}</Text>
                      {task.tracking === 'streak' ? (
                        <Text style={[typography.caption2, { color: c.textSubtle }]}>
                          Streak · no XP
                        </Text>
                      ) : (
                        <Text style={[typography.caption2, { color: c.textSubtle }]}>
                          {task.xp} XP
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            : null}
        </View>
      );
    });

  return (
    <View style={styles.wrap}>
      <View style={[styles.searchWrap, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
        <MaterialIcons name="search" size={18} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks…"
          placeholderTextColor={c.textSubtle}
          style={[styles.searchInput, { color: c.text }]}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')}>
            <MaterialIcons name="close" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {query.trim() ? (
        <View style={styles.results}>
          {results.length === 0 ? (
            <View style={styles.emptySearch}>
              <Text style={[typography.body, { color: c.textSoft }]}>
                No task called &apos;{query.trim()}&apos;.
              </Text>
              {onRequestCustom ? (
                <Pressable
                  onPress={() => onRequestCustom(query.trim())}
                  style={[styles.customBtn, { borderColor: glassBorder(0.15) }]}>
                  <Text style={[typography.footnote, { color: c.textSoft }]}>
                    Create &quot;{query.trim()}&quot; as a new task
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            results.slice(0, 24).map((task) => {
              const on = selectedSet.has(task.id);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => {
                    toggle(task.id);
                    setQuery('');
                  }}
                  style={[styles.resultRow, { borderBottomColor: glassBorder(0.08) }]}>
                  <MaterialIcons
                    name={on ? 'check-circle' : 'add-circle-outline'}
                    size={20}
                    color={on ? c.textSoft : c.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskName, { color: c.text }]}>{task.name}</Text>
                    <Text style={[typography.caption2, { color: c.textSubtle }]}>
                      {task.domainId.replace(/_/g, ' ')} · {task.groupId.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : tab === 'homework' ? (
        <GlassCard style={styles.homeworkCard}>
          <Text style={[typography.footnote, { color: c.textSubtle, marginBottom: space.sm }]}>
            Homework &amp; Education
          </Text>
          {renderGroupList(homework?.groups ?? [])}
        </GlassCard>
      ) : (
        <View style={styles.grid}>
          {domains.map((domain) => (
            <Pressable
              key={domain.id}
              onPress={() => openDomain(domain)}
              style={[
                styles.tile,
                { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) },
              ]}>
              <MaterialIcons
                name={domain.tracking === 'streak' ? 'spa' : 'home'}
                size={22}
                color={c.textSoft}
              />
              <Text style={[styles.tileLabel, { color: c.text }]} numberOfLines={2}>
                {domain.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {onRequestCustom && !query.trim() && tab === 'chores' ? (
        <Pressable onPress={() => onRequestCustom('')} style={styles.createLink}>
          <Text style={[typography.footnote, { color: c.textSoft }]}>Create a task</Text>
        </Pressable>
      ) : null}

      <View style={[styles.footer, { borderTopColor: glassBorder(0.1) }]}>
        <Text style={[typography.footnote, { color: c.textSoft }]}>
          Selected: {selectedIds.length} task{selectedIds.length === 1 ? '' : 's'}
        </Text>
        {selectedIds.length > 0 ? (
          <Pressable onPress={() => onChange([])}>
            <Text style={[typography.footnote, { color: c.textMuted }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {selectedTasks.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {selectedTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => toggle(task.id)}
              style={[styles.chip, { backgroundColor: glass(0.08), borderColor: glassBorder(0.12) }]}>
              <Text style={[styles.chipText, { color: c.text }]}>{task.name}</Text>
              <MaterialIcons name="close" size={14} color={c.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Modal visible={Boolean(domainSheet)} animationType="slide" transparent>
        <View style={[styles.sheetScrim, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,28,42,0.45)' }]}>
          {/* Opaque sheet — never use glass/card rgba here or the domain grid bleeds through. */}
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: c.backgroundSoft,
                borderColor: glassBorder(0.12),
              },
            ]}>
            <View style={styles.sheetHead}>
              <Text style={[typography.title3, { color: c.text }]}>{domainSheet?.name}</Text>
              <Pressable onPress={() => setDomainSheet(null)} hitSlop={12}>
                <MaterialIcons name="close" size={22} color={c.textMuted} />
              </Pressable>
            </View>
            {domainSheet?.id === 'personal_hygiene' ? (
              <Text style={[typography.footnote, { color: c.textSoft, marginBottom: space.sm }]}>
                Hygiene builds a daily streak instead of XP.
              </Text>
            ) : null}
            <ScrollView
              style={{ backgroundColor: c.backgroundSoft }}
              contentContainerStyle={{ backgroundColor: c.backgroundSoft }}>
              {domainSheet ? renderGroupList(domainSheet.groups) : null}
            </ScrollView>
            <Pressable
              onPress={() => setDomainSheet(null)}
              style={[
                styles.doneBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,28,42,0.08)',
                  borderColor: glassBorder(0.14),
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <Text style={[typography.headline, { color: c.text }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '22%',
    flexGrow: 1,
    minWidth: 72,
    maxWidth: '24%',
    aspectRatio: 1,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  tileLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  results: { maxHeight: 280 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptySearch: { gap: 10, paddingVertical: 16 },
  customBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    padding: 12,
    alignItems: 'center',
  },
  createLink: { alignSelf: 'center', paddingVertical: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chips: { maxHeight: 44 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600', maxWidth: 140 },
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groupBlock: { marginBottom: 8 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitleHit: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  groupTitle: { fontSize: 15, fontWeight: '700' },
  selectAll: { fontSize: 13, fontWeight: '600' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskName: { fontSize: 15, fontWeight: '600' },
  doneBtn: {
    marginTop: 8,
    borderRadius: radius.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  homeworkCard: { padding: 12 },
});
