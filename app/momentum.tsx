import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { MomentumRing } from '@/components/orbit/momentum-ring';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function MomentumScreen() {
  const { household, metrics, poppinsWeeklyBriefing } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>{household.householdName}</Text>
        <Text style={typography.title1}>Momentum</Text>
        <Text style={typography.body}>
          Momentum blends task completion, grocery readiness, and calendar coverage.
        </Text>
      </View>

      <GlassCard elevated style={styles.hero}>
        <View style={styles.heroCopy}>
          <StatusPill label={metrics.momentum >= 80 ? 'Strong' : metrics.momentum >= 60 ? 'Steady' : 'Needs lift'} tone="cyan" />
          <Text style={typography.title2}>{metrics.momentum}</Text>
          <Text style={typography.footnote}>
            Weekly change {poppinsWeeklyBriefing.momentumChange >= 0 ? '+' : ''}
            {poppinsWeeklyBriefing.momentumChange}
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
        <Text style={typography.headline}>What lifts momentum</Text>
        <Text style={typography.footnote}>• Complete open tasks ({metrics.openTasks} remaining)</Text>
        <Text style={typography.footnote}>• Restock missing groceries ({metrics.missingGroceries})</Text>
        <Text style={typography.footnote}>• Confirm coverage on upcoming events ({metrics.upcomingEvents})</Text>
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
  const { c } = useOrbitColors();
  return (
    <GlassCard style={styles.gridCard}>
      <Text style={[styles.metric, { color: c.text }]}>{value}</Text>
      <Text style={typography.footnote}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  gridCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: space.xs,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: space.sm,
    paddingRight: space.md,
  },
  metric: {
    fontSize: 28,
    fontWeight: '800',
  },
});
