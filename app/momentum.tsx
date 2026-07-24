import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { MomentumRing } from '@/components/orbit/momentum-ring';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function MomentumScreen() {
  const { household, metrics, novaWeeklyBriefing } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>Momentum</Text>
        <Text style={orbitTypography.body}>
          Momentum blends task completion, grocery readiness, and calendar coverage.
        </Text>
      </View>

      <GlassCard elevated style={styles.hero}>
        <View style={styles.heroCopy}>
          <StatusPill label={metrics.momentum >= 80 ? 'Strong' : metrics.momentum >= 60 ? 'Steady' : 'Needs lift'} tone="cyan" />
          <Text style={orbitTypography.title}>{metrics.momentum}</Text>
          <Text style={orbitTypography.caption}>
            Weekly change {novaWeeklyBriefing.momentumChange >= 0 ? '+' : ''}
            {novaWeeklyBriefing.momentumChange}
          </Text>
        </View>
        <MomentumRing score={metrics.momentum} />
      </GlassCard>

      <View style={styles.grid}>
        <MetricCard label="Tasks" value={`${metrics.taskCompletionRate}%`} />
        <MetricCard label="Groceries" value={`${metrics.groceryReadiness}%`} />
        <MetricCard label="Calendar" value={`${metrics.calendarCoverage}%`} />
        <MetricCard label="Open tasks" value={`${metrics.openTasks}`} />
      </View>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>What lifts momentum</Text>
        <Text style={orbitTypography.caption}>• Complete open tasks ({metrics.openTasks} remaining)</Text>
        <Text style={orbitTypography.caption}>• Restock missing groceries ({metrics.missingGroceries})</Text>
        <Text style={orbitTypography.caption}>• Confirm coverage on upcoming events ({metrics.upcomingEvents})</Text>
      </GlassCard>

      <OrbitButton onPress={() => router.push('/household-balance' as never)}>View load balance</OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.push('/weekly-report' as never)}>
        Weekly report
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard style={styles.gridCard}>
      <Text style={styles.metric}>{value}</Text>
      <Text style={orbitTypography.caption}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.sm,
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
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: orbitSpacing.sm,
    paddingRight: orbitSpacing.md,
  },
  metric: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '800',
  },
});
