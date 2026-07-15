import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const statusTone = {
  Pending: 'blue',
  'In Progress': 'cyan',
  Completed: 'green',
  Overdue: 'red',
} as const;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { completeTask, household } = useOrbit();
  const task = household.tasks.find((item) => item.id === id);

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

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{task.category}</Text>
        <Text style={orbitTypography.display}>{task.title}</Text>
        <StatusPill label={task.status} tone={statusTone[task.status]} />
      </View>

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

      {task.status !== 'Completed' ? (
        <OrbitButton onPress={() => completeTask(task.id)}>Mark Complete</OrbitButton>
      ) : null}
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
