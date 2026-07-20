import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
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
        <ChoremaxxLogo size="lg" />
        <Text style={orbitTypography.display}>Your AI-powered household OS.</Text>
        <Text style={orbitTypography.body}>
          Tasks, Plan, Rewards, and Nova — one calm command center for home.
        </Text>
      </View>

      <GlassCard elevated style={styles.panel}>
        <OrbitButton onPress={() => router.push('/onboarding' as never)}>Get Started</OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/sign-in' as never)}>
          Sign In
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
