import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useOrbit();
  const [email, setEmail] = useState('sarah@orbit.test');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleReset = async () => {
    setSending(true);
    try {
      await forgotPassword(email);
      setMessage('If this email is configured for Choremaxx, a reset link has been sent. Check your inbox.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send reset email right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      showBack
      kicker="Account recovery"
      title="Reset password"
      subtitle="Enter the email for your Choremaxx account to receive a reset link."
      footer={
        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>Back to sign in</Text>
        </Pressable>
      }>
      <OrbitInput
        autoCapitalize="none"
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder="you@home.com"
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <OrbitButton disabled={sending || !email.trim()} onPress={() => void handleReset()}>
        {sending ? 'Sending…' : 'Send reset link'}
      </OrbitButton>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  message: { color: orbitColors.success, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  secondary: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
  },
  secondaryText: { color: orbitColors.textMuted, fontSize: 14, fontWeight: '700' },
});
