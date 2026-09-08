/**
 * Assign homework — Sidekick first, subject, library groups, one clear CTA.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { isMemberFullyConnected } from '@/lib/household/member-connection';
import { householdDueTimeLocal } from '@/lib/rules/household-view';
import { HOMEWORK_SUBJECT_CHIPS } from '@/lib/poppins/homework-compose';
import { buildLibraryAssignInput } from '@/lib/tasks/assign-from-library';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import { homeworkDomain, type LibraryTask } from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

const DUE_OPTIONS = [
  { id: 'Today', label: 'Today', offset: 0 },
  { id: 'Tomorrow', label: 'Tomorrow', offset: 1 },
  { id: 'This week', label: 'This week', offset: 3 },
] as const;

function sidekickMembers(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (member) => member.role === 'child' && member.status === 'active' && isMemberFullyConnected(member)
  );
}

function assignErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  return raw.replace(/^[A-Za-z]+Repository\.\w+:\s*/i, '').trim() || 'Could not assign homework. Try again.';
}

export default function AssignHomeworkScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ member?: string }>();
  const { accentTheme, createTask, household, permissions, v2Permissions } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();

  const kids = useMemo(() => sidekickMembers(household.members), [household.members]);
  const initialId =
    kids.find((m) => m.name === params.member)?.id ?? kids[0]?.id ?? null;

  const [assigneeId, setAssigneeId] = useState<string | null>(initialId);
  const [subject, setSubject] = useState<string>('Math');
  const [customSubject, setCustomSubject] = useState('');
  const [dueId, setDueId] = useState<(typeof DUE_OPTIONS)[number]['id']>('Today');
  const [selected, setSelected] = useState<LibraryTask[]>([]);
  const [busy, setBusy] = useState(false);

  const domain = homeworkDomain();
  const assignee = kids.find((m) => m.id === assigneeId) ?? null;
  const resolvedSubject = (customSubject.trim() || subject).trim();
  const canAssign = v2Permissions.canAssignOrEditTask || permissions.canCreateTask;

  const toggleTask = (task: LibraryTask) => {
    setSelected((current) =>
      current.some((item) => item.id === task.id)
        ? current.filter((item) => item.id !== task.id)
        : [...current, task]
    );
  };

  const handleAssign = async () => {
    if (!canAssign || !assignee || selected.length === 0) return;
    setBusy(true);
    try {
      const dueOpt = DUE_OPTIONS.find((item) => item.id === dueId) ?? DUE_OPTIONS[0];
      const now = new Date();
      now.setDate(now.getDate() + dueOpt.offset);
      const occurrenceDate = formatLocalDate(now);
      const dueAt = dueAtForFrequency('daily', now, householdDueTimeLocal(household, now))?.toISOString();

      for (const task of selected) {
        await createTask(
          buildLibraryAssignInput(task, assignee.name, task.defaultFrequency, {
            now,
            dueTimeLocal: householdDueTimeLocal(household, now),
            dueLabel: dueOpt.label,
            occurrenceDate,
            dueAt,
            homeworkSubject: resolvedSubject,
            assigneeMember: assignee,
          })
        );
      }
      router.back();
    } catch (error) {
      Alert.alert('Could not assign', assignErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.backgroundSoft, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text, fontWeight: '700' }]}>Assign homework</Text>
        <View style={{ width: 22 }} />
      </View>

      <PersistentScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Sidekick</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personRow}>
          {kids.map((member) => {
            const active = member.id === assigneeId;
            const photo = isAvatarImageUri(member.avatar);
            return (
              <Pressable
                key={member.id}
                onPress={() => setAssigneeId(member.id)}
                style={[
                  styles.personChip,
                  {
                    borderColor: active ? accentTheme.primary : glassBorder(0.12),
                    backgroundColor: active ? `${accentTheme.primary}18` : glass(0.05),
                  },
                ]}>
                <View style={[styles.avatar, { backgroundColor: `${accentTheme.primary}33` }]}>
                  {photo ? (
                    <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarEmoji}>{memberDisplayEmoji(member)}</Text>
                  )}
                </View>
                <Text style={[styles.personName, { color: c.text }]} numberOfLines={1}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: space.md }]}>Subject</Text>
        <View style={styles.chipRow}>
          {HOMEWORK_SUBJECT_CHIPS.map((chip) => {
            const active = !customSubject.trim() && subject === chip.label;
            return (
              <Pressable
                key={chip.id}
                onPress={() => {
                  setSubject(chip.label);
                  setCustomSubject('');
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? c.planPurple : glassBorder(0.12),
                    backgroundColor: active ? `${c.planPurple}22` : glass(0.05),
                  },
                ]}>
                <Text style={[styles.chipText, { color: active ? c.planPurple : c.text }]}>
                  {chip.emoji} {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={customSubject}
          onChangeText={setCustomSubject}
          placeholder="Custom subject"
          placeholderTextColor={c.textSubtle}
          style={[styles.customSubject, { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.04) }]}
        />

        <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: space.md }]}>Due</Text>
        <View style={styles.chipRow}>
          {DUE_OPTIONS.map((opt) => {
            const active = dueId === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setDueId(opt.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? accentTheme.primary : glassBorder(0.12),
                    backgroundColor: active ? `${accentTheme.primary}18` : glass(0.05),
                  },
                ]}>
                <Text style={[styles.chipText, { color: active ? accentTheme.primary : c.text }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/create-task',
              params: {
                tab: 'homework',
                assignee: assignee?.name ?? '',
                subject: resolvedSubject,
                due: dueId,
              },
            } as never)
          }
          style={styles.customLink}>
          <Text style={[typography.subheadline, { color: accentTheme.primary, fontWeight: '600' }]}>
            Custom homework
          </Text>
        </Pressable>

        {domain?.groups.map((group) => (
          <View key={group.id} style={{ marginTop: space.md }}>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{group.name}</Text>
            <View style={[styles.listCard, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
              {group.tasks.map((task, index) => {
                const picked = selected.some((item) => item.id === task.id);
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => toggleTask(task)}
                    style={[
                      styles.row,
                      index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassBorder(0.08) } : null,
                    ]}>
                    <View
                      style={[
                        styles.check,
                        {
                          borderColor: picked ? accentTheme.primary : glassBorder(0.2),
                          backgroundColor: picked ? accentTheme.primary : 'transparent',
                        },
                      ]}>
                      {picked ? <MaterialIcons name="check" size={14} color={c.ink} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: c.text, fontWeight: '600' }]}>{task.name}</Text>
                      <Text style={[typography.caption1, { color: c.textMuted }]}>{task.xp} XP</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </PersistentScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, space.md),
            borderTopColor: glassBorder(0.1),
            backgroundColor: c.backgroundSoft,
          },
        ]}>
        <Pressable
          disabled={!assignee || selected.length === 0 || busy || !canAssign}
          onPress={() => void handleAssign()}
          style={[
            styles.cta,
            {
              backgroundColor: accentTheme.primary,
              opacity: !assignee || selected.length === 0 || busy ? 0.45 : 1,
            },
          ]}>
          <Text style={[typography.headline, { color: c.ink, fontWeight: '700' }]}>
            {busy
              ? 'Assigning…'
              : assignee
                ? `Assign ${selected.length || ''} to ${assignee.name}`.trim()
                : 'Pick a Sidekick'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  body: { paddingHorizontal: space.md, paddingTop: space.sm },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: space.sm,
    textTransform: 'uppercase',
  },
  personRow: { gap: space.sm, paddingBottom: space.xs },
  personChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: space.sm,
    width: 88,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  avatarImage: { height: 48, width: 48 },
  avatarEmoji: { fontSize: 22 },
  personName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  customSubject: {
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  customLink: { alignItems: 'center', marginTop: space.md, paddingVertical: space.xs },
  listCard: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: space.md, padding: space.md },
  check: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  cta: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    paddingVertical: 16,
  },
});
