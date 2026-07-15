import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';

const statusTone = {
  Pending: 'blue',
  'In Progress': 'cyan',
  Completed: 'green',
  Overdue: 'red',
} as const;

const categories = ['Cleaning', 'Kitchen', 'Laundry', 'School', 'Homework', 'Groceries', 'Pets', 'Maintenance'];
const repeats: HouseholdTask['repeat'][] = ['None', 'Daily', 'Weekly', 'Weekdays'];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { completeTask, household, permissions, updateTask } = useOrbit();
  const task = household.tasks.find((item) => item.id === id);
  const memberNames = useMemo(
    () => household.members.filter((member) => member.status === 'active').map((member) => member.name),
    [household.members]
  );

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [category, setCategory] = useState(task?.category ?? categories[0]);
  const [assignee, setAssignee] = useState(task?.assignee ?? '');
  const [due, setDue] = useState(task?.due ?? '');
  const [xp, setXp] = useState(String(task?.xp ?? 15));
  const [repeat, setRepeat] = useState<HouseholdTask['repeat']>(task?.repeat ?? 'None');
  const [busy, setBusy] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  if (!task) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Task not found</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const canEdit = permissions.canCreateTask || permissions.canAssignTask;

  const handleComplete = async () => {
    await completeTask(task.id);
    setCelebrated(true);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateTask({
        ...task,
        title,
        description,
        category,
        assignee,
        due,
        xp: Number(xp) || task.xp,
        repeat,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{task.category}</Text>
        <Text style={orbitTypography.display}>{editing ? 'Edit task' : task.title}</Text>
        <StatusPill label={task.status} tone={statusTone[task.status]} />
      </View>

      {celebrated ? (
        <GlassCard>
          <Text style={orbitTypography.cardTitle}>Nice work</Text>
          <Text style={orbitTypography.body}>+{task.xp} XP added. Rankings week XP and streak updated.</Text>
        </GlassCard>
      ) : null}

      {editing ? (
        <GlassCard style={styles.card}>
          <OrbitInput label="Title" value={title} onChangeText={setTitle} />
          <OrbitInput label="Description" value={description} onChangeText={setDescription} />
          <ChoiceRow label="Category" options={categories} value={category} onChange={setCategory} />
          <ChoiceRow label="Assignee" options={memberNames} value={assignee} onChange={setAssignee} />
          <OrbitInput label="Due" value={due} onChangeText={setDue} />
          <OrbitInput keyboardType="number-pad" label="XP" value={xp} onChangeText={setXp} />
          <ChoiceRow label="Repeat" options={repeats} value={repeat} onChange={setRepeat} />
        </GlassCard>
      ) : (
        <GlassCard style={styles.card}>
          <DetailRow label="Assignee" value={task.assignee} />
          <DetailRow label="Due" value={task.due} />
          <DetailRow label="XP" value={`${task.xp} XP`} />
          <DetailRow label="Repeat" value={task.repeat} />
          <View style={styles.block}>
            <Text style={orbitTypography.caption}>Description</Text>
            <Text style={orbitTypography.body}>{task.description || 'No additional details for this task.'}</Text>
          </View>
        </GlassCard>
      )}

      {editing ? (
        <>
          <OrbitButton disabled={busy || title.trim().length < 2} onPress={handleSave}>
            Save changes
          </OrbitButton>
          <OrbitButton tone="secondary" onPress={() => setEditing(false)}>
            Cancel edit
          </OrbitButton>
        </>
      ) : (
        <>
          {task.status !== 'Completed' ? (
            <OrbitButton onPress={handleComplete}>Mark Complete</OrbitButton>
          ) : null}
          {canEdit ? (
            <OrbitButton tone="secondary" onPress={() => setEditing(true)}>
              Edit task
            </OrbitButton>
          ) : null}
        </>
      )}

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={orbitTypography.caption}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: orbitSpacing.xs,
  },
  card: {
    gap: orbitSpacing.md,
  },
  row: {
    gap: 4,
  },
  value: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
