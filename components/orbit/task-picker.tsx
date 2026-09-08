/**
 * Shared task picker — search + 14 chore domain tiles (§4).
 * Reused by onboarding Step B and Tasks add-task flow.
 * Task rows show XP · Frequency (Rev F §10.1) — adjustable per selection.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import Icon from '@/components/orbit/design/Icon';
import { domainIconName } from '@/components/orbit/design/icon-map';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  normalizeRewardSettings,
  resolveTaskXp,
  type RewardMode,
} from '@/lib/rewards/reward-mode';
import {
  FREQUENCY_LABELS,
  MORE_FREQUENCIES,
  PRIMARY_FREQUENCIES,
  frequencyLabel,
  isMoreFrequency,
} from '@/lib/tasks/frequency-labels';
import {
  choreDomains,
  homeworkDomain,
  type Frequency,
  type LibraryTask,
  type TaskDomain,
  type TaskGroup,
} from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export type TaskPickerTab = 'chores' | 'homework';

export type TaskFrequencyMap = Record<string, Frequency>;

type TaskPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Per-selected-task frequency (defaults to library defaultFrequency). */
  frequencies?: TaskFrequencyMap;
  onFrequenciesChange?: (frequencies: TaskFrequencyMap) => void;
  /** chores = 14 domain tiles; homework = groups only (§4.6). */
  tab?: TaskPickerTab;
  onRequestCustom?: (query: string) => void;
  /**
   * Prefer this over household.rewardMode (onboarding picks Equity before a
   * household exists — store still defaults to Meritocracy / weighted).
   */
  rewardMode?: RewardMode;
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
  frequencies: frequenciesProp,
  onFrequenciesChange,
  tab = 'chores',
  onRequestCustom,
  rewardMode: rewardModeProp,
}: TaskPickerProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const { accentTheme, household } = useOrbit();
  const rewardSettings = useMemo(
    () =>
      normalizeRewardSettings({
        rewardMode: rewardModeProp ?? household.rewardMode,
        hygieneRewarded: household.hygieneRewarded,
        hygieneXp: household.hygieneXp,
      }),
    [
      household.hygieneRewarded,
      household.hygieneXp,
      household.rewardMode,
      rewardModeProp,
    ]
  );
  const [query, setQuery] = useState('');
  const [domainSheet, setDomainSheet] = useState<TaskDomain | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [localFrequencies, setLocalFrequencies] = useState<TaskFrequencyMap>({});
  const [freqPickerTaskId, setFreqPickerTaskId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const frequencies = frequenciesProp ?? localFrequencies;
  const setFrequencies = (next: TaskFrequencyMap) => {
    if (onFrequenciesChange) onFrequenciesChange(next);
    if (frequenciesProp === undefined) setLocalFrequencies(next);
  };

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

  const freqFor = (task: LibraryTask): Frequency =>
    frequencies[task.id] ?? task.defaultFrequency;

  const pruneFrequencies = (ids: string[], base: TaskFrequencyMap = frequencies) => {
    const keep = new Set(ids);
    const next: TaskFrequencyMap = {};
    for (const [id, freq] of Object.entries(base)) {
      if (keep.has(id)) next[id] = freq;
    }
    return next;
  };

  const toggle = (task: LibraryTask | string) => {
    const id = typeof task === 'string' ? task : task.id;
    if (selectedSet.has(id)) {
      const nextIds = selectedIds.filter((x) => x !== id);
      onChange(nextIds);
      setFrequencies(pruneFrequencies(nextIds));
      return;
    }
    const libraryTask =
      typeof task === 'string' ? searchable.find((t) => t.id === id) : task;
    onChange([...selectedIds, id]);
    setFrequencies({
      ...frequencies,
      [id]: frequencies[id] ?? libraryTask?.defaultFrequency ?? 'weekly',
    });
  };

  const selectGroup = (group: TaskGroup) => {
    const ids = group.tasks.map((t) => t.id);
    const next = new Set(selectedIds);
    const allSelected = ids.every((id) => next.has(id));
    const nextFreq = { ...frequencies };
    if (allSelected) {
      ids.forEach((id) => {
        next.delete(id);
        delete nextFreq[id];
      });
    } else {
      ids.forEach((id) => {
        next.add(id);
        const task = group.tasks.find((t) => t.id === id);
        if (task && !nextFreq[id]) nextFreq[id] = task.defaultFrequency;
      });
    }
    onChange([...next]);
    setFrequencies(pruneFrequencies([...next], nextFreq));
  };

  const openFrequencyPicker = (task: LibraryTask) => {
    const freq = freqFor(task);
    setMoreOpen(isMoreFrequency(freq));
    setFreqPickerTaskId(task.id);
    if (!selectedSet.has(task.id)) toggle(task);
  };

  const chooseFrequency = (freq: Frequency) => {
    if (!freqPickerTaskId) return;
    if (!selectedSet.has(freqPickerTaskId)) {
      onChange([...selectedIds, freqPickerTaskId]);
    }
    setFrequencies({ ...frequencies, [freqPickerTaskId]: freq });
    setFreqPickerTaskId(null);
  };

  const pickerTask = searchable.find((t) => t.id === freqPickerTaskId);
  const pickerCurrent = pickerTask ? freqFor(pickerTask) : undefined;

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
                const freq = freqFor(task);
                const xpLabel =
                  task.tracking === 'streak'
                    ? 'Streak · no XP'
                    : `${resolveTaskXp(
                        { baseXp: task.xp, xpEligible: true },
                        {
                          mode: rewardSettings.rewardMode,
                          hygieneRewarded: rewardSettings.hygieneRewarded,
                          hygieneXp: rewardSettings.hygieneXp,
                        }
                      )} XP${rewardSettings.rewardMode === 'flat' ? ' · Equity' : ''}`;
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => toggle(task)}
                    style={[styles.taskRow, { borderBottomColor: glassBorder(0.08) }]}>
                    <MaterialIcons
                      name={on ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={on ? c.textSoft : c.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskName, { color: c.text }]}>{task.name}</Text>
                      <View style={styles.metaRow}>
                        <Text style={[typography.caption2, { color: c.textSubtle }]}>
                          {xpLabel}
                        </Text>
                        <Text style={[typography.caption2, { color: c.textFaint }]}>·</Text>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            openFrequencyPicker(task);
                          }}
                          hitSlop={10}
                          style={styles.freqHit}>
                          <Text
                            style={[
                              typography.caption2,
                              { color: accentTheme.primary, fontWeight: '700' },
                            ]}>
                            {frequencyLabel(freq)}
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
              const freq = freqFor(task);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => {
                    toggle(task);
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
                    <View style={styles.metaRow}>
                      <Text style={[typography.caption2, { color: c.textSubtle }]}>
                        {task.domainId.replace(/_/g, ' ')} ·{' '}
                        {task.tracking === 'streak'
                          ? 'Streak · no XP'
                          : `${resolveTaskXp(
                              { baseXp: task.xp, xpEligible: true },
                              {
                                mode: rewardSettings.rewardMode,
                                hygieneRewarded: rewardSettings.hygieneRewarded,
                                hygieneXp: rewardSettings.hygieneXp,
                              }
                            )} XP${rewardSettings.rewardMode === 'flat' ? ' · Equity' : ''}`}
                      </Text>
                      <Text style={[typography.caption2, { color: c.textFaint }]}>·</Text>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          openFrequencyPicker(task);
                        }}
                        hitSlop={10}
                        style={styles.freqHit}>
                        <Text
                          style={[
                            typography.caption2,
                            { color: accentTheme.primary, fontWeight: '700' },
                          ]}>
                          {frequencyLabel(freq)}
                        </Text>
                        <MaterialIcons name="expand-more" size={14} color={accentTheme.primary} />
                      </Pressable>
                    </View>
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
              <Icon name={domainIconName(domain.id)} size={28} />
              <Text style={[styles.tileLabel, { color: c.text }]} numberOfLines={1}>
                {domain.shortName ?? domain.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {onRequestCustom && !query.trim() && tab === 'chores' ? (
        <Pressable onPress={() => onRequestCustom('')} style={styles.createLink}>
          <Text style={[typography.footnote, { color: c.textSoft }]}>Create custom task</Text>
        </Pressable>
      ) : null}

      <View style={[styles.footer, { borderTopColor: glassBorder(0.1) }]}>
        <Text style={[typography.footnote, { color: c.textSoft }]}>
          Selected: {selectedIds.length} task{selectedIds.length === 1 ? '' : 's'}
        </Text>
        {selectedIds.length > 0 ? (
          <Pressable
            onPress={() => {
              onChange([]);
              setFrequencies({});
            }}>
            <Text style={[typography.footnote, { color: c.textMuted }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {selectedTasks.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {selectedTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => toggle(task)}
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

      <Modal visible={Boolean(freqPickerTaskId)} animationType="fade" transparent>
        <Pressable
          style={[styles.freqScrim, { backgroundColor: 'rgba(3,8,16,0.55)' }]}
          onPress={() => setFreqPickerTaskId(null)}>
          <Pressable
            style={[
              styles.freqCard,
              { backgroundColor: c.backgroundSoft, borderColor: glassBorder(0.1) },
            ]}
            onPress={(e) => e.stopPropagation?.()}>
            <View style={[styles.freqHandle, { backgroundColor: glass(0.18) }]} />
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

            <View style={styles.freqSegment}>
              {PRIMARY_FREQUENCIES.map((f) => {
                const active = pickerCurrent === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => chooseFrequency(f)}
                    style={[
                      styles.freqSegmentItem,
                      active && { backgroundColor: `${accentTheme.primary}28` },
                    ]}>
                    <Text
                      style={[
                        styles.freqSegmentText,
                        { color: active ? accentTheme.primary : c.textSoft },
                      ]}>
                      {FREQUENCY_LABELS[f]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setMoreOpen((v) => !v)}
              style={styles.freqMoreToggle}
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
              <View style={styles.freqMoreList}>
                {MORE_FREQUENCIES.map((f) => {
                  const active = pickerCurrent === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => chooseFrequency(f)}
                      style={[
                        styles.freqMoreRow,
                        active && { backgroundColor: `${accentTheme.primary}18` },
                      ]}>
                      <Text
                        style={[
                          typography.body,
                          {
                            color: active ? accentTheme.primary : c.text,
                            fontWeight: active ? '700' : '500',
                          },
                        ]}>
                        {FREQUENCY_LABELS[f]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  freqHit: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  doneBtn: {
    marginTop: 8,
    borderRadius: radius.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  homeworkCard: { padding: 12 },
  freqScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  freqCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  freqHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  freqSegment: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  freqSegmentItem: {
    flex: 1,
    borderRadius: radius.control,
    paddingVertical: 12,
    alignItems: 'center',
  },
  freqSegmentText: { fontSize: 14, fontWeight: '700' },
  freqMoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  freqMoreList: { gap: 2 },
  freqMoreRow: {
    borderRadius: radius.control,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
});
