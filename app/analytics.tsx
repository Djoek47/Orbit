import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function AnalyticsScreen() {
  const { household, metrics, poppinsWeeklyBriefing, permissions } = useOrbit();
  const { c } = useOrbitColors();

  if (!permissions.canViewAnalytics) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={typography.title2}>Analytics locked</Text>
        <Text style={typography.body}>Analytics requires a role with household visibility enabled.</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const totalXp = household.members.reduce((sum, member) => sum + member.xp, 0);
  const avgLoad =
    household.members.length > 0
      ? Math.round(household.members.reduce((sum, member) => sum + member.loadShare, 0) / household.members.length)
      : 0;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>Owner / admin</Text>
        <Text style={typography.title1}>Analytics</Text>
        <Text style={typography.body}>Participation, momentum, and Poppins usage for {household.householdName}.</Text>
      </View>

      <GlassCard style={styles.card}>
        <StatusPill label="Participation" tone="blue" />
        <Text style={[styles.metric, { color: c.text }]}>{metrics.taskCompletionRate}%</Text>
        <Text style={typography.footnote}>Task completion across the household</Text>
        <Text style={typography.footnote}>
          {household.members.length} members · {totalXp} total XP · avg load {avgLoad}%
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <StatusPill label="Momentum" tone="cyan" />
        <Text style={[styles.metric, { color: c.text }]}>{metrics.momentum}</Text>
        <Text style={typography.footnote}>
          Composite of tasks ({metrics.taskCompletionRate}%), groceries ({metrics.groceryReadiness}%),
          calendar ({metrics.calendarCoverage}%)
        </Text>
        <Text style={typography.footnote}>
          Weekly delta {poppinsWeeklyBriefing.momentumChange >= 0 ? '+' : ''}
          {poppinsWeeklyBriefing.momentumChange}
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <StatusPill label="Poppins usage" tone="green" />
        <Text style={[styles.metric, { color: c.text }]}>{poppinsWeeklyBriefing.recommendations.length}</Text>
        <Text style={typography.footnote}>Active recommendation slots this week</Text>
        <Text style={typography.footnote}>Briefing: {poppinsWeeklyBriefing.title}</Text>
        <Text style={typography.footnote}>Ask Poppins from the Poppins tab for live co-manager guidance.</Text>
      </GlassCard>

      <OrbitButton onPress={() => router.push('/weekly-report' as never)}>Open weekly report</OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.push('/momentum' as never)}>
        Momentum details
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  metric: {
    fontSize: 34,
    fontWeight: '800',
  },
});
