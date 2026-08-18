import * as AppleAuthentication from 'expo-apple-authentication';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { SignInSuccess } from '@/components/orbit/sign-in-success';
import {
  authIssue,
  isEmailNotConfirmedError,
  resolveAuthIssue,
  type AuthIssue,
} from '@/lib/auth/auth-errors';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { goToFreshLogin } from '@/lib/navigation/fresh-login';
import { isMockMode } from '@/repositories/repository-utils';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function SignInScreen() {
  const { accentTheme, orbitPalette, signIn, hydrateFromSession, applyStashedInvite, isPendingMember } = useOrbit();
  const { c } = useOrbitColors();
  const mock = isMockMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const finishToHome = async () => {
    setShowSuccess(false);
    const joined = await applyStashedInvite();
    if (joined === 'pending' || isPendingMember) {
      router.replace('/pending-approval' as never);
      return;
    }
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
      setIssue(authIssue('missing_fields'));
      return;
    }

    try {
      setBusy(true);
      setIssue(null);
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
      setIssue(resolveAuthIssue(err));
    } finally {
      setBusy(false);
    }
  };

  const handleApple = async () => {
    try {
      setIssue(null);
      const session = await signInWithApple();
      if (hydrateFromSession) {
        await hydrateFromSession(session);
      } else {
        await signIn({ email: session.user.email, password: 'apple' });
      }
      setShowSuccess(true);
    } catch (err) {
      const resolved = resolveAuthIssue(err);
      if (resolved.code === 'apple_canceled') return;
      setIssue(resolved);
    }
  };

  return (
    <>
      <AuthShell
        showBack
        onBack={() => void goToFreshLogin()}
        brandHero
        kicker="Welcome back"
        title="Sign in"
        subtitle="Open your household with your Choremaxx account, or Get Started to create one."
        footer={
          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push('/forgot-password' as never)}>
              <Text style={[styles.link, { color: accentTheme.primary }]}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => void goToFreshLogin()} style={styles.switchRow}>
              <Text style={[styles.switchMuted, { color: c.textMuted }]}>New here?</Text>
              <Text style={[styles.link, { color: accentTheme.primary }]}>Get Started</Text>
            </Pressable>
          </View>
        }>
        <OrbitInput
          autoCapitalize="none"
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (issue) setIssue(null);
          }}
          keyboardType="email-address"
          placeholder="you@home.com"
        />
        <OrbitInput
          autoCapitalize="none"
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (issue) setIssue(null);
          }}
          secureTextEntry
          placeholder="Your password"
        />
        <AuthErrorBanner
          issue={issue}
          actionParams={{ email: email.trim() }}
          onDismiss={() => setIssue(null)}
        />

        <OrbitButton disabled={busy || showSuccess} onPress={() => void handleSignIn()}>
          {busy ? 'Signing in…' : 'Sign in'}
        </OrbitButton>

        {appleAvailable && Platform.OS === 'ios' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: orbitPalette.border }]} />
              <Text style={[styles.dividerText, { color: c.textSubtle }]}>or</Text>
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
            <MaterialIcons name="info-outline" size={14} color={c.textSubtle} />
            <Text style={[styles.hintText, { color: c.textSubtle }]}>
              Use the email you signed up with. New here? Tap Get Started.
            </Text>
          </View>
        ) : null}
      </AuthShell>

      <SignInSuccess visible={showSuccess} onDone={finishToHome} />
    </>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { fontSize: 12, fontWeight: '600' },
  appleButton: { height: 48, width: '100%' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hintText: { fontSize: 12, flex: 1 },
  footerLinks: { alignItems: 'center', gap: 14 },
  link: { fontSize: 14, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchMuted: { fontSize: 14 },
});
