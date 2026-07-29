import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
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
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>{report.title || 'Weekly report'}</Text>
        <Text style={orbitTypography.body}>{report.summary}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Completed" value={`${report.tasksCompleted}`} tone="green" />
        <StatCard label="Missed" value={`${report.tasksMissed}`} tone="red" />
        <StatCard label="Groceries" value={`${report.groceriesPurchased}`} tone="cyan" />
        <StatCard label="XP earned" value={`${report.xpEarned}`} tone="amber" />
      </View>

      <GlassCard style={styles.card}>
        <StatusPill label="Highlights" tone="blue" />
        <Text style={orbitTypography.cardTitle}>Most active</Text>
        <Text style={orbitTypography.body}>{report.mostActiveMember}</Text>
        <Text style={orbitTypography.caption}>
          Momentum {report.momentumChange >= 0 ? '+' : ''}
          {report.momentumChange} this week
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Nova recommendations</Text>
        {report.recommendations.map((item) => (
          <Text key={item} style={orbitTypography.caption}>
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
  return (
    <GlassCard style={styles.gridCard}>
      <StatusPill label={label} tone={tone} />
      <Text style={styles.metric}>{value}</Text>
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
    gap: orbitSpacing.sm,
  },
  metric: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '800',
  },
});
