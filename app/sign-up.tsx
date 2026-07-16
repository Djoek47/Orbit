import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SignUpScreen() {
  const { accentTheme, signUp } = useOrbit();
  const [email, setEmail] = useState('new@orbit.test');
  const [password, setPassword] = useState('orbit-demo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to create your account.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await signUp({ email, password });
      router.replace('/create-profile' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      showBack
      kicker="Start your Orbit"
      title="Create account"
      subtitle="Then set up your profile and create or join a household."
      footer={
        <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.switchRow}>
          <Text style={styles.switchMuted}>Already have an account?</Text>
          <Text style={[styles.link, { color: accentTheme.primary }]}>Sign in</Text>
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
      <OrbitInput
        autoCapitalize="none"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Create a password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => void handleSignUp()} disabled={busy} style={styles.ctaWrap}>
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? 'Creating…' : 'Create account'}</Text>
        </LinearGradient>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: { color: orbitColors.danger, fontSize: 13, fontWeight: '700' },
  ctaWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  cta: { alignItems: 'center', paddingVertical: 15 },
  ctaText: { color: '#070D1C', fontSize: 15, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  switchMuted: { color: orbitColors.textMuted, fontSize: 14 },
  link: { fontSize: 14, fontWeight: '700' },
});
