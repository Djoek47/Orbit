import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';

const categories = ['Cleaning', 'Kitchen', 'Laundry', 'School', 'Homework', 'Groceries', 'Pets', 'Maintenance'];
const duePresets = ['Today, 7:00 PM', 'Today, 8:00 PM', 'Tomorrow morning', 'This weekend'];
const repeats: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];

export default function CreateTaskScreen() {
  const { createTask, household, permissions } = useOrbit();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [assignee, setAssignee] = useState(household.members[0]?.name ?? '');
  const [due, setDue] = useState(duePresets[0]);
  const [xp, setXp] = useState('15');
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');

  const memberNames = useMemo(
    () => household.members.filter((member) => member.status === 'active').map((member) => member.name),
    [household.members]
  );
  const canSave = title.trim().length > 1 && due.trim().length > 1 && Number(xp) > 0;

  if (!permissions.canCreateTask) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Creating tasks is locked</Text>
        <Text style={orbitTypography.body}>Your role can complete assigned work, but not create new tasks.</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    createTask({
      title,
      description,
      category,
      assignee: permissions.canAssignTask ? assignee : household.greetingName,
      due,
      xp: Number(xp),
      repeat,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Responsibilities</Text>
          <Text style={orbitTypography.display}>Create Task</Text>
          <Text style={orbitTypography.body}>Assign clear work with due time, XP, and an optional note.</Text>
        </View>

        <GlassCard>
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
          <OrbitInput keyboardType="number-pad" label="XP value" onChangeText={setXp} placeholder="15" value={xp} />
          <ChoiceRow label="Repeat" onChange={setRepeat} options={repeats} value={repeat} />
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
