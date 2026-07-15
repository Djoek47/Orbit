import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function PendingApprovalScreen() {
  const { household, refreshHousehold } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Almost there</Text>
        <Text style={orbitTypography.display}>Waiting for approval</Text>
        <Text style={orbitTypography.body}>
          Your request to join {household.householdName} is pending. An owner or admin needs to approve you on
          Members before full access unlocks.
        </Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <StatusPill label="Pending adult" tone="amber" />
        <Text style={orbitTypography.cardTitle}>Limited access is active</Text>
        <Text style={orbitTypography.caption}>
          You can browse calmly, but creating tasks, groceries, and invites stay locked until approval lands.
        </Text>
      </GlassCard>

      <OrbitButton
        onPress={async () => {
          await refreshHousehold();
          router.replace('/' as never);
        }}>
        Check approval status
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.push('/settings' as never)}>
        Open settings
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
  note: {
    color: orbitColors.textMuted,
  },
});
