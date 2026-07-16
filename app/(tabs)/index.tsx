import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { GlassCard } from '@/components/orbit/glass-card';
import { MomentumRing } from '@/components/orbit/momentum-ring';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function HomeScreen() {
  const {
    household,
    metrics,
    novaBriefing,
    permissions,
    unreadNotificationCount,
    currentMember,
  } = useOrbit();

  const todayTasks = household.tasks.filter((task) => task.status !== 'Completed').slice(0, 3);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.topBar}>
        <View style={styles.topCopy}>
          <Text style={orbitTypography.caption}>{household.householdName}</Text>
          <Text style={orbitTypography.display}>Good morning, {household.greetingName}</Text>
          {currentMember ? (
            <StatusPill
              label={currentMember.status === 'pending' ? 'pending approval' : currentMember.role}
              tone={currentMember.status === 'pending' ? 'amber' : 'cyan'}
            />
          ) : null}
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/notifications' as never)}>
            <Text style={styles.iconLabel}>
              {unreadNotificationCount > 0 ? `● ${unreadNotificationCount}` : '○'}
            </Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/settings' as never)}>
            <Text style={styles.iconLabel}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {currentMember?.status === 'pending' ? (
        <GlassCard>
          <StatusPill label="Waiting for approval" tone="amber" />
          <Text style={orbitTypography.cardTitle}>Access is limited</Text>
          <Text style={orbitTypography.caption}>
            An owner or admin needs to approve you on Members before you can create tasks or manage groceries.
          </Text>
        </GlassCard>
      ) : null}

      <Pressable onPress={() => router.push('/momentum' as never)}>
        <GlassCard elevated style={styles.heroCard}>
          <View style={styles.heroText}>
            <StatusPill label={`${metrics.taskCompletionRate}% tasks`} tone="green" />
            <Text style={orbitTypography.title}>Household Momentum</Text>
            <Text style={orbitTypography.caption}>
              {metrics.openTasks} open · {metrics.missingGroceries} missing · {metrics.upcomingEvents} upcoming
            </Text>
            <Text style={styles.linkHint}>View details</Text>
          </View>
          <MomentumRing score={metrics.momentum} />
        </GlassCard>
      </Pressable>

      <Pressable onPress={() => router.push('/(tabs)/nova' as never)}>
        <GlassCard>
          <View style={orbitScreen.row}>
            <View style={styles.novaCopy}>
              <Text style={orbitTypography.cardTitle}>{novaBriefing.title}</Text>
              <Text style={orbitTypography.caption}>{novaBriefing.summary}</Text>
              <Text style={styles.linkHint}>Ask Nova</Text>
            </View>
            <NovaOrb />
          </View>
        </GlassCard>
      </Pressable>

      <View style={styles.primaryActions}>
        {permissions.canCreateTask ? (
          <OrbitButton style={styles.primaryButton} onPress={() => router.push('/create-task' as never)}>
            Create Task
          </OrbitButton>
        ) : null}
        {permissions.canManageGroceries ? (
          <OrbitButton
            style={styles.primaryButton}
            tone="secondary"
            onPress={() => router.push('/add-grocery' as never)}>
            + Missing Item
          </OrbitButton>
        ) : null}
      </View>

      <GlassCard>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Today</Text>
          <Pressable onPress={() => router.push('/(tabs)/tasks' as never)}>
            <Text style={styles.linkHint}>All tasks</Text>
          </Pressable>
        </View>
        {todayTasks.length === 0 ? (
          <Text style={orbitTypography.caption}>No open tasks — household is clear.</Text>
        ) : (
          todayTasks.map((task) => (
            <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}` as never)}>
              <OrbitListItem
                completed={task.status === 'Completed'}
                meta={`${task.category} · ${task.assignee} · ${task.due}`}
                title={task.title}
                trailing={<StatusPill label={task.status} tone={task.status === 'Overdue' ? 'red' : 'blue'} />}
              />
            </Pressable>
          ))
        )}
      </GlassCard>

      <GlassCard>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Upcoming</Text>
          <Pressable onPress={() => router.push('/(tabs)/plan' as never)}>
            <Text style={styles.linkHint}>Plan</Text>
          </Pressable>
        </View>
        {household.events.slice(0, 3).map((event) => (
          <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}` as never)}>
            <OrbitListItem
              meta={`${event.date} · ${event.responsible}`}
              title={event.title}
              trailing={<Text style={styles.eventTime}>{event.time}</Text>}
            />
          </Pressable>
        ))}
      </GlassCard>

      <Pressable onPress={() => router.push('/household-balance' as never)}>
        <GlassCard>
          <Text style={orbitTypography.cardTitle}>Household balance</Text>
          {household.members.slice(0, 3).map((member) => (
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
          <Text style={styles.linkHint}>Open full balance</Text>
        </GlassCard>
      </Pressable>
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
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconLabel: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  linkHint: {
    color: orbitColors.novaCyan,
    fontSize: 13,
    fontWeight: '700',
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
  novaCopy: {
    flex: 1,
    gap: orbitSpacing.xs,
    paddingRight: orbitSpacing.md,
  },
  primaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.md,
  },
  primaryButton: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  topActions: {
    flexDirection: 'row',
    gap: orbitSpacing.sm,
  },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: orbitSpacing.md,
    justifyContent: 'space-between',
  },
  topCopy: {
    flex: 1,
    gap: orbitSpacing.xs,
  },
});
