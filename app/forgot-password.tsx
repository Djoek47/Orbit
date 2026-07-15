import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useOrbit();
  const [email, setEmail] = useState('sarah@orbit.test');
  const [message, setMessage] = useState('');

  const handleReset = async () => {
    await forgotPassword(email);
    setMessage('Mock reset link queued. Real email delivery will come with Supabase auth.');
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Account recovery</Text>
        <Text style={orbitTypography.display}>Reset password</Text>
        <Text style={orbitTypography.body}>This placeholder keeps the auth structure ready for Supabase.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <OrbitInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <OrbitButton onPress={handleReset}>Send Reset Link</OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: orbitSpacing.md,
  },
  message: {
    color: orbitColors.success,
    fontSize: 13,
    fontWeight: '700',
  },
});
