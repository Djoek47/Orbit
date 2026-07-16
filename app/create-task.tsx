import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { TASK_PRESETS, type TaskPreset } from '@/data/task-presets';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { computeTaskXp, weightForDifficulty } from '@/lib/tasks/xp';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask, TaskDifficulty } from '@/types/orbit';

const categories = ['Cleaning', 'Kitchen', 'Laundry', 'School', 'Homework', 'Groceries', 'Pets', 'Maintenance'];
const duePresets = ['Today, 7:00 PM', 'Today, 8:00 PM', 'Tomorrow morning', 'This weekend'];
const repeats: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];
const difficulties: TaskDifficulty[] = ['easy', 'medium', 'hard'];

export default function CreateTaskScreen() {
  const { createTask, household, permissions } = useOrbit();
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [presetId, setPresetId] = useState(TASK_PRESETS[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [assignee, setAssignee] = useState(household.members[0]?.name ?? '');
  const [due, setDue] = useState(duePresets[0]);
  const [baseXp, setBaseXp] = useState('15');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('easy');
  const [proofRequired, setProofRequired] = useState('Optional');
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const memberNames = useMemo(
    () => household.members.filter((member) => member.status === 'active').map((member) => member.name),
    [household.members]
  );
  const householdTemplates = household.taskTemplates ?? [];
  const selectedPreset: TaskPreset | undefined =
    TASK_PRESETS.find((item) => item.id === presetId) ??
    (householdTemplates.find((item) => item.id === presetId)
      ? {
          id: presetId,
          title: householdTemplates.find((item) => item.id === presetId)!.title,
          category: householdTemplates.find((item) => item.id === presetId)!.category,
          baseXp: householdTemplates.find((item) => item.id === presetId)!.baseXp,
          difficulty: householdTemplates.find((item) => item.id === presetId)!.difficulty,
          weight: householdTemplates.find((item) => item.id === presetId)!.weight,
          repeat: householdTemplates.find((item) => item.id === presetId)!.repeat,
          proofRequired: householdTemplates.find((item) => item.id === presetId)!.proofRequired,
          description: householdTemplates.find((item) => item.id === presetId)!.description,
        }
      : undefined);

  const weight = mode === 'preset' ? selectedPreset?.weight ?? 1 : weightForDifficulty(difficulty);
  const xpPreview =
    mode === 'preset'
      ? computeTaskXp(selectedPreset?.baseXp ?? 15, selectedPreset?.weight, selectedPreset?.difficulty)
      : computeTaskXp(Number(baseXp) || 15, weight, difficulty);

  const canSave =
    mode === 'preset'
      ? Boolean(selectedPreset)
      : title.trim().length > 1 && due.trim().length > 1 && Number(baseXp) > 0;

  if (!permissions.canCreateTask) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Creating tasks is locked</Text>
        <Text style={orbitTypography.body}>Your role can complete assigned work, but not create new tasks.</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Cancel
        </OrbitButton>
      </ScrollView>
    );
  }

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    if (mode === 'preset' && selectedPreset) {
      createTask({
        title: selectedPreset.title,
        description: selectedPreset.description,
        category: selectedPreset.category,
        assignee: permissions.canAssignTask ? assignee : household.greetingName,
        due,
        xp: computeTaskXp(selectedPreset.baseXp, selectedPreset.weight, selectedPreset.difficulty),
        weight: selectedPreset.weight,
        difficulty: selectedPreset.difficulty,
        proofRequired: selectedPreset.proofRequired,
        repeat: selectedPreset.repeat,
      });
    } else {
      createTask({
        title,
        description,
        category,
        assignee: permissions.canAssignTask ? assignee : household.greetingName,
        due,
        xp: xpPreview,
        weight,
        difficulty,
        proofRequired: proofRequired === 'Required',
        repeat,
        saveAsTemplate: permissions.canManageHousehold && saveAsTemplate,
      });
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Responsibilities</Text>
          <Text style={orbitTypography.display}>Create New</Text>
          <Text style={orbitTypography.body}>Preset chores first. Admins can mint custom weighted tasks.</Text>
        </View>

        <View style={styles.toggleRow}>
          {(['preset', 'custom'] as const).map((option) => {
            const active = mode === option;
            return (
              <Pressable
                key={option}
                onPress={() => setMode(option)}
                style={[styles.toggleButton, active && styles.toggleButtonActive]}>
                <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
                  {option === 'preset' ? 'Presets' : 'Custom'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'preset' ? (
          <GlassCard style={styles.card}>
            <Text style={orbitTypography.cardTitle}>Chore catalog</Text>
            <View style={styles.presetGrid}>
              {TASK_PRESETS.map((preset) => {
                const active = preset.id === presetId;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => setPresetId(preset.id)}
                    style={[styles.presetChip, active && styles.presetChipActive]}>
                    <Text style={[styles.presetTitle, active && styles.presetTitleActive]}>{preset.title}</Text>
                    <Text style={orbitTypography.caption}>
                      {preset.difficulty} · {computeTaskXp(preset.baseXp, preset.weight, preset.difficulty)} XP
                    </Text>
                  </Pressable>
                );
              })}
              {householdTemplates.map((tpl) => (
                <Pressable
                  key={tpl.id}
                  onPress={() => setPresetId(tpl.id)}
                  style={[styles.presetChip, presetId === tpl.id && styles.presetChipActive]}>
                  <StatusPill label="Household" tone="cyan" />
                  <Text style={styles.presetTitle}>{tpl.title}</Text>
                </Pressable>
              ))}
            </View>
            {permissions.canAssignTask ? (
              <ChoiceRow label="Assigned person" onChange={setAssignee} options={memberNames} value={assignee} />
            ) : null}
            <ChoiceRow label="Due preset" onChange={setDue} options={duePresets} value={due} />
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            {!permissions.canManageHousehold ? (
              <Text style={orbitTypography.caption}>Custom mint is admin-only. You can still use presets.</Text>
            ) : null}
            <OrbitInput label="Task title" onChangeText={setTitle} placeholder="Take out trash" value={title} />
            <OrbitInput
              label="Description"
              onChangeText={setDescription}
              placeholder="Any details the assignee should know"
              value={description}
            />
            <ChoiceRow label="Category" onChange={setCategory} options={categories} value={category} />
            {permissions.canAssignTask ? (
              <ChoiceRow label="Assigned person" onChange={setAssignee} options={memberNames} value={assignee} />
            ) : null}
            <ChoiceRow label="Due preset" onChange={setDue} options={duePresets} value={due} />
            <OrbitInput label="Due label" onChangeText={setDue} placeholder="Today, 7:00 PM" value={due} />
            <OrbitInput
              keyboardType="number-pad"
              label="Base XP"
              onChangeText={setBaseXp}
              placeholder="15"
              value={baseXp}
            />
            <ChoiceRow label="Difficulty / weight" onChange={setDifficulty} options={difficulties} value={difficulty} />
            <ChoiceRow
              label="Photo proof"
              onChange={setProofRequired}
              options={['Optional', 'Required']}
              value={proofRequired}
            />
            <ChoiceRow label="Repeat" onChange={setRepeat} options={repeats} value={repeat} />
            {permissions.canManageHousehold ? (
              <OrbitButton tone="secondary" onPress={() => setSaveAsTemplate((value) => !value)}>
                {saveAsTemplate ? 'Will save to household catalog' : 'Also save as household preset'}
              </OrbitButton>
            ) : null}
          </GlassCard>
        )}

        <GlassCard>
          <Text style={orbitTypography.caption}>XP preview (base × weight)</Text>
          <Text style={orbitTypography.title}>+{xpPreview} XP · weight {weight}</Text>
        </GlassCard>

        <OrbitButton disabled={!canSave} onPress={handleSave}>
          Save Task
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Cancel
        </OrbitButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
  presetChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    gap: 4,
    padding: orbitSpacing.sm,
    width: '48%',
  },
  presetChipActive: {
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.35)',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  presetTitle: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  presetTitleActive: {
    color: orbitColors.orbitBlue,
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    paddingVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderColor: 'rgba(56,189,248,0.3)',
  },
  toggleLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  toggleLabelActive: {
    color: orbitColors.orbitBlue,
    fontWeight: '700',
  },
  toggleRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.hero,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
});
