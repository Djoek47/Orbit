import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function WeeklyReportScreen() {
  const { household, novaWeeklyBriefing } = useOrbit();
  const report = novaWeeklyBriefing;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>{household.householdName}</Text>
        <Text style={typography.title1}>{report.title || 'Weekly report'}</Text>
        <Text style={typography.body}>{report.summary}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Completed" value={`${report.tasksCompleted}`} tone="green" />
        <StatCard label="Missed" value={`${report.tasksMissed}`} tone="red" />
        <StatCard label="Groceries" value={`${report.groceriesPurchased}`} tone="cyan" />
        <StatCard label="XP earned" value={`${report.xpEarned}`} tone="amber" />
      </View>

      <GlassCard style={styles.card}>
        <StatusPill label="Highlights" tone="blue" />
        <Text style={typography.headline}>Most active</Text>
        <Text style={typography.body}>{report.mostActiveMember}</Text>
        <Text style={typography.footnote}>
          Momentum {report.momentumChange >= 0 ? '+' : ''}
          {report.momentumChange} this week
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={typography.headline}>Nova recommendations</Text>
        {report.recommendations.map((item) => (
          <Text key={item} style={typography.footnote}>
            • {item}
          </Text>
        ))}
      </GlassCard>

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'red' | 'cyan' | 'amber';
}) {
  const { c } = useOrbitColors();
  return (
    <GlassCard style={styles.gridCard}>
      <StatusPill label={label} tone={tone} />
      <Text style={[styles.metric, { color: c.text }]}>{value}</Text>
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
    gap: space.sm,
  },
  metric: {
    fontSize: 28,
    fontWeight: '800',
  },
});
