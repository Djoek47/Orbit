import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function HouseholdSetupScreen() {
  const { currentUser, hasHousehold, isSignedIn } = useOrbit();

  if (!isSignedIn) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (!currentUser?.profileComplete) {
    return <Redirect href={'/create-profile' as never} />;
  }

  if (hasHousehold) {
    return <Redirect href={'/' as never} />;
  }

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Household setup</Text>
        <Text style={orbitTypography.display}>Create or join</Text>
        <Text style={orbitTypography.body}>Orbit needs one household before tasks, groceries, and rewards can sync.</Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <StatusPill label="Owner path" tone="cyan" />
        <Text style={orbitTypography.cardTitle}>Create a new household</Text>
        <Text style={orbitTypography.caption}>Start a home, become owner, then invite members when you are ready.</Text>
        <OrbitButton onPress={() => router.push('/create-household' as never)}>Create Household</OrbitButton>
      </GlassCard>

      <GlassCard style={styles.card}>
        <StatusPill label="Member path" tone="blue" />
        <Text style={orbitTypography.cardTitle}>Join with an invite code</Text>
        <Text style={orbitTypography.caption}>Enter a code from another Orbit household and wait for approval.</Text>
        <OrbitButton tone="secondary" onPress={() => router.push('/join-household' as never)}>
          Join Household
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
});
