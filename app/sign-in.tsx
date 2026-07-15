import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { useOrbit } from '@/store/orbit-store';

export default function SignInScreen() {
  const { signIn, hydrateFromSession } = useOrbit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }

    try {
      setError('');
      await signIn({ email, password });
      router.replace('/' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    }
  };

  const handleApple = async () => {
    try {
      setError('');
      const session = await signInWithApple();
      if (hydrateFromSession) {
        await hydrateFromSession(session);
      } else {
        await signIn({ email: session.user.email, password: 'apple' });
      }
      router.replace('/' as never);
    } catch (err) {
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Apple Sign-In failed.');
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Welcome back</Text>
        <Text style={orbitTypography.display}>Sign in</Text>
        <Text style={orbitTypography.body}>Sign in to your Orbit household. Use email or Sign in with Apple.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <OrbitInput
          autoCapitalize="none"
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <OrbitInput
          autoCapitalize="none"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton onPress={handleSignIn}>Sign In</OrbitButton>
        {appleAvailable && Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={16}
            style={styles.appleButton}
            onPress={handleApple}
          />
        ) : null}
        <OrbitButton tone="secondary" onPress={() => router.push('/forgot-password' as never)}>
          Forgot Password
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/sign-up' as never)}>
          Create Account
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  appleButton: {
    height: 48,
    width: '100%',
  },
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: orbitSpacing.md,
  },
});
