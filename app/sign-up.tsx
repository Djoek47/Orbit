import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SignUpScreen() {
  const { signUp } = useOrbit();
  const [email, setEmail] = useState('new@orbit.test');
  const [password, setPassword] = useState('orbit-demo');
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to create your account.');
      return;
    }

    setError('');
    await signUp({ email, password });
    router.replace('/create-profile' as never);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Start your Orbit</Text>
        <Text style={orbitTypography.display}>Create account</Text>
        <Text style={orbitTypography.body}>Create an Orbit account, then set up or join a household.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <OrbitInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <OrbitInput label="Password" value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton onPress={handleSignUp}>Create Account</OrbitButton>
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
