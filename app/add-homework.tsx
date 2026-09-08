/**
 * Sidekick self-add homework — publishes to Plan immediately (no approval).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { buildSelfHomeworkTaskInput } from '@/lib/calendar/sidekick-homework';
import { radius, space, typography } from '@/constants/orbit-theme';
import { householdDueTimeLocal } from '@/lib/rules/household-view';
import { HOMEWORK_SUBJECT_CHIPS } from '@/lib/poppins/homework-compose';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const DUE_OPTIONS = [
  { id: 'Today', label: 'Today', offset: 0 },
  { id: 'Tomorrow', label: 'Tomorrow', offset: 1 },
  { id: 'This week', label: 'This week', offset: 3 },
] as const;

export default function AddHomeworkScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, createTask, currentMember, household, orbitPalette, permissions } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();

  const [subject, setSubject] = useState('Math');
  const [customSubject, setCustomSubject] = useState('');
  const [title, setTitle] = useState('');
  const [dueId, setDueId] = useState<(typeof DUE_OPTIONS)[number]['id']>('Today');
  const [busy, setBusy] = useState(false);

  const isSidekick = isSidekickRole(currentMember?.role);
  const canAdd = Boolean(currentMember) && (isSidekick || permissions.canManageHousehold);
  const resolvedSubject = (customSubject.trim() || subject).trim();
  const canSave = canAdd && title.trim().length > 1 && resolvedSubject.length > 0;

  const handleSave = async () => {
    if (!canSave || !currentMember || busy) return;
    setBusy(true);
    try {
      const dueOpt = DUE_OPTIONS.find((item) => item.id === dueId) ?? DUE_OPTIONS[0];
      const now = new Date();
      now.setDate(now.getDate() + dueOpt.offset);
      const occurrenceDate = formatLocalDate(now);
      const dueAt = dueAtForFrequency('daily', now, householdDueTimeLocal(household, now))?.toISOString();

      await createTask(
        buildSelfHomeworkTaskInput(currentMember, {
          title: title.trim(),
          subject: resolvedSubject,
          dueLabel: dueOpt.label,
          occurrenceDate,
          dueAt,
        }),
        { selfHomework: true }
      );
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not add homework',
        error instanceof Error ? error.message : 'Try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canAdd) {
    return (
      <View style={[styles.root, { backgroundColor: c.backgroundSoft, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialIcons name="close" size={22} color={c.textMuted} />
          </Pressable>
        </View>
        <View style={styles.locked}>
          <Text style={[typography.title2, { color: c.text, fontWeight: '700' }]}>Homework</Text>
          <Text style={[typography.body, { color: c.textMuted, marginTop: 8 }]}>
            Switch to your Sidekick profile to add homework here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.backgroundSoft, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <MaterialIcons name="close" size={22} color={c.textMuted} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text, fontWeight: '700' }]}>Homework</Text>
        <View style={{ width: 22 }} />
      </View>

      <PersistentScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Adds to your Plan immediately — no approval needed.
        </Text>

        <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>WHAT</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Worksheet, reading, project…"
          placeholderTextColor={c.textSubtle}
          style={[styles.titleInput, { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.04) }]}
        />

        <Text style={[styles.sectionLabel, { color: c.textSubtle, marginTop: space.lg }]}>SUBJECT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
                    borderColor: active ? accentTheme.primary : glassBorder(0.12),
                    backgroundColor: active ? `${accentTheme.primary}18` : glass(0.04),
                  },
                ]}>
                <Text style={[styles.chipText, { color: active ? accentTheme.primary : c.text }]}>
                  {chip.emoji} {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          value={customSubject}
          onChangeText={setCustomSubject}
          placeholder="Other subject"
          placeholderTextColor={c.textSubtle}
          style={[styles.customSubject, { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.04) }]}
        />

        <Text style={[styles.sectionLabel, { color: c.textSubtle, marginTop: space.lg }]}>DUE</Text>
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
                    backgroundColor: active ? `${accentTheme.primary}18` : glass(0.04),
                  },
                ]}>
                <Text style={[styles.chipText, { color: active ? accentTheme.primary : c.text }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </PersistentScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: glassBorder(0.08) }]}>
        <Pressable
          disabled={!canSave || busy}
          onPress={() => void handleSave()}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: canSave ? accentTheme.primary : `${accentTheme.primary}44`,
            },
          ]}>
          <Text style={[styles.primaryBtnText, { color: orbitPalette.ink }]}>
            {busy ? 'Adding…' : 'Add to Plan'}
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
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  locked: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  lead: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: space.lg,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: space.sm,
  },
  titleInput: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customSubject: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  primaryBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
