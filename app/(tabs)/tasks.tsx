import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const statusTone = {
  Pending: 'blue',
  'In Progress': 'cyan',
  Completed: 'green',
  Overdue: 'red',
} as const;

export default function TasksScreen() {
  const { completeTask, household, metrics, permissions } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Responsibilities</Text>
        <Text style={orbitTypography.display}>Tasks</Text>
        <Text style={orbitTypography.body}>
          {metrics.taskCompletionRate}% complete. Completions add XP, week XP, and streak for Rankings.
        </Text>
      </View>

      {permissions.canCreateTask ? (
        <OrbitButton onPress={() => router.push('/create-task' as never)}>Create Task</OrbitButton>
      ) : (
        <Text style={orbitTypography.caption}>Your role can complete assigned tasks, but not create new ones.</Text>
      )}

      {household.tasks.map((task) => (
        <GlassCard key={task.id} style={task.status === 'Completed' && styles.completedCard}>
          <Pressable onPress={() => router.push(`/task/${task.id}` as never)}>
            <View style={orbitScreen.row}>
              <StatusPill label={task.status} tone={statusTone[task.status]} />
              <Text style={styles.xp}>{task.xp} XP</Text>
            </View>
            <OrbitListItem
              completed={task.status === 'Completed'}
              meta={`${task.category} • ${task.assignee} • ${task.due} • ${task.repeat}`}
              title={task.title}
            />
          </Pressable>
          {task.status !== 'Completed' ? (
            <OrbitButton tone="secondary" onPress={() => completeTask(task.id)}>
              Mark Complete
            </OrbitButton>
          ) : null}
        </GlassCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  completedCard: {
    opacity: 0.72,
  },
  xp: {
    color: orbitColors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
});
