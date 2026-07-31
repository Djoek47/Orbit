import * as AppleAuthentication from 'expo-apple-authentication';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { SignInSuccess } from '@/components/orbit/sign-in-success';
import { orbitColors } from '@/constants/orbit-theme';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { isMockMode } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';

const MOCK_DEMO_EMAIL = 'sarah@orbit.test';
const MOCK_DEMO_PASSWORD = 'orbit-demo';

export default function SignInScreen() {
  const { accentTheme, signIn, hydrateFromSession } = useOrbit();
  const mock = isMockMode();
  const [email, setEmail] = useState(mock ? MOCK_DEMO_EMAIL : '');
  const [password, setPassword] = useState(mock ? MOCK_DEMO_PASSWORD : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const finishToHome = async () => {
    setShowSuccess(false);
    const session = await import('@/lib/device/device-session').then((m) => m.loadDeviceSession());
    if (session.mode === 'shared' && session.profileMemberIds.length > 0) {
      const { markNeedsProfilePick } = await import('@/lib/device/device-session');
      await markNeedsProfilePick();
      router.replace('/select-profile' as never);
      return;
    }
    router.replace('/' as never);
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await signIn({ email, password });
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
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
      setShowSuccess(true);
    } catch (err) {
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Apple Sign-In failed.');
    }
  };

  return (
    <>
      <AuthShell
        showBack
        brandHero
        kicker="Welcome back"
        title="Sign in"
        subtitle={
          mock
            ? 'Open your household. Demo credentials are prefilled for the Rivera home.'
            : 'Sign in with the account you created, or tap Get Started to make a household.'
        }
        footer={
          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push('/forgot-password' as never)}>
              <Text style={[styles.link, { color: accentTheme.primary }]}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/welcome' as never)} style={styles.switchRow}>
              <Text style={styles.switchMuted}>New here?</Text>
              <Text style={[styles.link, { color: accentTheme.primary }]}>Get Started</Text>
            </Pressable>
          </View>
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
          placeholder="Your password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <OrbitButton disabled={busy || showSuccess} onPress={() => void handleSignIn()}>
          {busy ? 'Signing in…' : 'Sign in'}
        </OrbitButton>

        {appleAvailable && Platform.OS === 'ios' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={16}
              style={styles.appleButton}
              onPress={() => void handleApple()}
            />
          </>
        ) : null}

        {mock ? (
          <View style={styles.demoHint}>
            <MaterialIcons name="info-outline" size={14} color={orbitColors.textSubtle} />
            <Text style={styles.demoText}>
              Demo: {MOCK_DEMO_EMAIL} · {MOCK_DEMO_PASSWORD}
            </Text>
          </View>
        ) : (
          <View style={styles.demoHint}>
            <MaterialIcons name="info-outline" size={14} color={orbitColors.textSubtle} />
            <Text style={styles.demoText}>
              Live account required. Use Get Started if you don’t have one yet.
            </Text>
          </View>
        )}
      </AuthShell>

      <SignInSuccess visible={showSuccess} onDone={finishToHome} />
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: orbitColors.danger, fontSize: 13, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { color: orbitColors.textSubtle, fontSize: 12, fontWeight: '600' },
  appleButton: { height: 48, width: '100%' },
  demoHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  demoText: { color: orbitColors.textSubtle, fontSize: 12, flex: 1 },
  footerLinks: { alignItems: 'center', gap: 14 },
  link: { fontSize: 14, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchMuted: { color: orbitColors.textMuted, fontSize: 14 },
});
