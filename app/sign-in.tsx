import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SignInScreen() {
  const { signIn } = useOrbit();
  const [email, setEmail] = useState('sarah@orbit.test');
  const [password, setPassword] = useState('orbit-demo');
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }

    setError('');
    await signIn({ email, password });
    router.replace('/' as never);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Welcome back</Text>
        <Text style={orbitTypography.display}>Sign in</Text>
        <Text style={orbitTypography.body}>Use the mock account to open the Rivera household demo.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <OrbitInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <OrbitInput label="Password" value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton onPress={handleSignIn}>Sign In</OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/forgot-password' as never)}>
          Forgot Password
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: orbitSpacing.md,
  },
});
