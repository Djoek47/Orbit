import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { MomentumRing } from '@/components/orbit/momentum-ring';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function HomeScreen() {
  const { household, metrics, novaBriefing, permissions, signOut } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>Good morning, {household.greetingName}</Text>
        <Text style={orbitTypography.body}>{novaBriefing.summary}</Text>
      </View>

      <GlassCard elevated style={styles.heroCard}>
        <View style={styles.heroText}>
          <StatusPill label={`${metrics.taskCompletionRate}% tasks`} tone="green" />
          <Text style={orbitTypography.title}>Household Momentum</Text>
          <Text style={orbitTypography.caption}>
            Calculated from task completion, grocery readiness, and calendar coverage.
          </Text>
        </View>
        <MomentumRing score={metrics.momentum} />
      </GlassCard>

      <GlassCard>
        <View style={orbitScreen.row}>
          <View style={styles.novaCopy}>
            <Text style={orbitTypography.cardTitle}>Nova briefing</Text>
            <Text style={orbitTypography.caption}>{novaBriefing.summary}</Text>
          </View>
          <NovaOrb />
        </View>
      </GlassCard>

      <View style={styles.quickActions}>
        <OrbitButton style={styles.quickButton} onPress={() => router.push('/create-task' as never)}>
          Create Task
        </OrbitButton>
        <OrbitButton
          style={styles.quickButton}
          tone="secondary"
          onPress={() => router.push('/add-grocery' as never)}>
          + Missing Item
        </OrbitButton>
        <OrbitButton
          disabled={!permissions.canInviteMembers}
          style={styles.quickButton}
          tone="secondary"
          onPress={() => router.push('/invite-household' as never)}>
          Invite
        </OrbitButton>
        <OrbitButton style={styles.quickButton} tone="secondary" onPress={() => router.push('/household-members' as never)}>
          Members
        </OrbitButton>
      </View>

      <View style={styles.grid}>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{metrics.openTasks}</Text>
          <Text style={orbitTypography.caption}>Open tasks</Text>
        </GlassCard>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{metrics.missingGroceries}</Text>
          <Text style={orbitTypography.caption}>Missing items</Text>
        </GlassCard>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{metrics.upcomingEvents}</Text>
          <Text style={orbitTypography.caption}>Events</Text>
        </GlassCard>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{metrics.groceryReadiness}%</Text>
          <Text style={orbitTypography.caption}>Grocery ready</Text>
        </GlassCard>
      </View>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Today&apos;s tasks</Text>
        {household.tasks.slice(0, 3).map((task) => (
          <OrbitListItem
            key={task.id}
            completed={task.status === 'Completed'}
            meta={`${task.category} • ${task.assignee} • ${task.due}`}
            title={task.title}
            trailing={<StatusPill label={task.status} tone={task.status === 'Completed' ? 'green' : 'blue'} />}
          />
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Upcoming events</Text>
        {household.events.slice(0, 3).map((event) => (
          <OrbitListItem
            key={event.id}
            meta={`${event.date} • ${event.responsible}`}
            title={event.title}
            trailing={<Text style={styles.eventTime}>{event.time}</Text>}
          />
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Household balance</Text>
        {household.members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <Text style={styles.avatar}>{member.avatar}</Text>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <View style={styles.loadTrack}>
                <View style={[styles.loadFill, { width: `${member.loadShare}%` }]} />
              </View>
            </View>
            <Text style={styles.loadText}>{member.loadShare}%</Text>
          </View>
        ))}
      </GlassCard>

      <OrbitButton tone="secondary" onPress={async () => {
        await signOut();
        router.replace('/welcome' as never);
      }}>
        Sign Out
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: 'rgba(41, 121, 255, 0.18)',
    borderRadius: 18,
    color: orbitColors.text,
    fontWeight: '800',
    height: 36,
    lineHeight: 36,
    textAlign: 'center',
    width: 36,
  },
  eventTime: {
    color: orbitColors.novaCyan,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.md,
  },
  gridCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: orbitSpacing.xs,
  },
  heroCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroText: {
    flex: 1,
    gap: orbitSpacing.sm,
    paddingRight: orbitSpacing.md,
  },
  loadFill: {
    backgroundColor: orbitColors.novaCyan,
    borderRadius: 999,
    height: 8,
  },
  loadText: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  loadTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  memberInfo: {
    flex: 1,
    gap: 8,
  },
  memberName: {
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  metric: {
    color: orbitColors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  novaCopy: {
    flex: 1,
    gap: orbitSpacing.xs,
    paddingRight: orbitSpacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.md,
  },
  quickButton: {
    flexBasis: '47%',
    flexGrow: 1,
  },
});
