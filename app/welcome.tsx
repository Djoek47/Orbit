import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function WelcomeScreen() {
  const { currentUser, hasHousehold, isLoading, isSignedIn } = useOrbit();

  if (!isLoading && isSignedIn && currentUser?.profileComplete && hasHousehold) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, styles.content]}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.hero}>
        <NovaOrb />
        <Text style={styles.brand}>Orbit</Text>
        <Text style={orbitTypography.display}>A calmer command center for home.</Text>
        <Text style={orbitTypography.body}>
          Tasks, groceries, calendar, rewards, and Nova briefings in one shared household rhythm. Scanned an invite
          QR? Sign in or create an account — your code will carry through to Join.
        </Text>
      </View>

      <GlassCard elevated style={styles.panel}>
        <OrbitButton onPress={() => router.push('/sign-in' as never)}>Sign In</OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/sign-up' as never)}>
          Create Account
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: orbitColors.novaCyan,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  content: {
    justifyContent: 'center',
    minHeight: '100%',
  },
  hero: {
    gap: orbitSpacing.md,
  },
  panel: {
    gap: orbitSpacing.md,
  },
});
