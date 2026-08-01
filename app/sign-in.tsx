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
import { isEmailNotConfirmedError } from '@/lib/auth/auth-errors';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { isMockMode } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';

/** Never surface repository prefixes / raw provider dumps to testers. */
function toUserFacingAuthError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message.trim() : '';
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (lower.startsWith('authrepository.') || lower.includes('provider (issuer')) {
    if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
      return 'Email or password is incorrect. Tap Get Started to create an account.';
    }
    if (lower.includes('apple') || lower.includes('provider')) {
      return 'Sign in with Apple isn’t set up yet. Use email and password, or tap Get Started.';
    }
    return fallback;
  }
  return raw;
}

export default function SignInScreen() {
  const { accentTheme, orbitPalette, signIn, hydrateFromSession } = useOrbit();
  const mock = isMockMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (isEmailNotConfirmedError(err)) {
        router.push({
          pathname: '/confirm-email',
          params: { email: err.email || email.trim() },
        } as never);
        return;
      }
      setError(toUserFacingAuthError(err, 'Sign in failed. Check your email and password.'));
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
      setError(toUserFacingAuthError(err, 'Apple Sign-In failed. Try email and password instead.'));
    }
  };

  return (
    <>
      <AuthShell
        showBack
        brandHero
        kicker="Welcome back"
        title="Sign in"
        subtitle="Open your household with your Choremaxx account, or Get Started to create one."
        footer={
          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push('/forgot-password' as never)}>
              <Text style={[styles.link, { color: accentTheme.primary }]}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/welcome' as never)} style={styles.switchRow}>
              <Text style={[styles.switchMuted, { color: orbitPalette.textMuted }]}>New here?</Text>
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
        {error ? <Text style={[styles.error, { color: orbitPalette.danger }]}>{error}</Text> : null}

        <OrbitButton disabled={busy || showSuccess} onPress={() => void handleSignIn()}>
          {busy ? 'Signing in…' : 'Sign in'}
        </OrbitButton>

        {appleAvailable && Platform.OS === 'ios' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: orbitPalette.border }]} />
              <Text style={[styles.dividerText, { color: orbitPalette.textSubtle }]}>or</Text>
              <View style={[styles.divider, { backgroundColor: orbitPalette.border }]} />
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

        {!mock ? (
          <View style={[styles.hint, { backgroundColor: orbitPalette.cardMuted }]}>
            <MaterialIcons name="info-outline" size={14} color={orbitPalette.textSubtle} />
            <Text style={[styles.hintText, { color: orbitPalette.textSubtle }]}>
              Live account required. Use Get Started if you don’t have one yet.
            </Text>
          </View>
        ) : null}
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hintText: { color: orbitColors.textSubtle, fontSize: 12, flex: 1 },
  footerLinks: { alignItems: 'center', gap: 14 },
  link: { fontSize: 14, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchMuted: { color: orbitColors.textMuted, fontSize: 14 },
});
