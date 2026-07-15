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
const repeats: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];

export default function CreateTaskScreen() {
  const { createTask, household } = useOrbit();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [assignee, setAssignee] = useState(household.members[0]?.name ?? '');
  const [due, setDue] = useState('Today, 7:00 PM');
  const [xp, setXp] = useState('15');
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>('None');

  const memberNames = useMemo(() => household.members.map((member) => member.name), [household.members]);
  const canSave = title.trim().length > 1 && due.trim().length > 1 && Number(xp) > 0;

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    createTask({
      title,
      category,
      assignee,
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
          <Text style={orbitTypography.body}>Add a task. It updates Home, Tasks, Rewards, and Nova.</Text>
        </View>

        <GlassCard>
          <OrbitInput label="Task title" onChangeText={setTitle} placeholder="Take out trash" value={title} />
          <ChoiceRow label="Category" onChange={setCategory} options={categories} value={category} />
          <ChoiceRow label="Assigned person" onChange={setAssignee} options={memberNames} value={assignee} />
          <OrbitInput label="Due time" onChangeText={setDue} placeholder="Today, 7:00 PM" value={due} />
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
