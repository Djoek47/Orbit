import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { MomentumRing } from '@/components/orbit/momentum-ring';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { mockHousehold } from '@/data/mock-household';

export default function HomeScreen() {
  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{mockHousehold.householdName}</Text>
        <Text style={orbitTypography.display}>Good morning, {mockHousehold.greetingName}</Text>
        <Text style={orbitTypography.body}>Your household is steady. Nova found 3 things worth attention.</Text>
      </View>

      <GlassCard elevated style={styles.heroCard}>
        <View style={styles.heroText}>
          <StatusPill label={`+${mockHousehold.trend}% this week`} tone="green" />
          <Text style={orbitTypography.title}>Household Momentum</Text>
          <Text style={orbitTypography.caption}>
            Based on tasks, groceries, calendar readiness, and load balance.
          </Text>
        </View>
        <MomentumRing score={mockHousehold.momentum} />
      </GlassCard>

      <GlassCard>
        <View style={orbitScreen.row}>
          <View style={styles.novaCopy}>
            <Text style={orbitTypography.cardTitle}>Nova briefing</Text>
            <Text style={orbitTypography.caption}>{mockHousehold.nova.summary}</Text>
          </View>
          <NovaOrb />
        </View>
      </GlassCard>

      <View style={styles.grid}>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{mockHousehold.tasks.filter((task) => task.status !== 'Completed').length}</Text>
          <Text style={orbitTypography.caption}>Open tasks</Text>
        </GlassCard>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{mockHousehold.missingGroceries}</Text>
          <Text style={orbitTypography.caption}>Missing items</Text>
        </GlassCard>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{mockHousehold.upcomingEvents}</Text>
          <Text style={orbitTypography.caption}>Events today</Text>
        </GlassCard>
        <GlassCard style={styles.gridCard}>
          <Text style={styles.metric}>{mockHousehold.completionRate}%</Text>
          <Text style={orbitTypography.caption}>Completion</Text>
        </GlassCard>
      </View>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Household balance</Text>
        {mockHousehold.members.map((member) => (
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
});
