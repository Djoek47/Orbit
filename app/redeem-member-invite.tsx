import * as AppleAuthentication from 'expo-apple-authentication';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { SignInSuccess } from '@/components/orbit/sign-in-success';
import {
  authIssue,
  isAuthRateLimitError,
  isEmailNotConfirmedError,
  isSafeHumanMessage,
  resolveAuthIssue,
  userFacingMessage,
  type AuthIssue,
} from '@/lib/auth/auth-errors';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { markAuthEmailSent } from '@/lib/auth/email-confirmation';
import { cancelSignedOutRestart } from '@/lib/navigation/session-restart';
import {
  consumeMemberInviteToken,
  peekMemberInviteToken,
  stashMemberInviteToken,
} from '@/lib/invite/member-invite-token-store';
import { orbitScreen, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/**
 * Admin / adult member invite — account + immediate redeem (no welcome detour).
 */
export default function RedeemMemberInviteScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { c } = useOrbitColors();
  const {
    accentTheme,
    hydrateFromSession,
    isSignedIn,
    isLoading,
    orbitPalette,
    redeemMemberInviteToken,
    signIn,
    signUp,
  } = useOrbit();

  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [redeemAttempted, setRedeemAttempted] = useState(false);

  const paramToken =
    typeof tokenParam === 'string' ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : '';

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pending = paramToken?.trim() || (await peekMemberInviteToken()) || '';
      if (cancelled || !pending) return;
      setToken(pending);
      await stashMemberInviteToken(pending);
    })();
    return () => {
      cancelled = true;
    };
  }, [paramToken]);

  const finishRedeem = async (inviteToken: string) => {
    setRedeeming(true);
    setError(null);
    try {
      const result = await redeemMemberInviteToken(inviteToken);
      await consumeMemberInviteToken();
      if (result.ok === false) {
        setError(result.message);
        return;
      }
      router.replace('/(tabs)' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'This invite is no longer valid. Ask an admin for a new one.'));
    } finally {
      setRedeeming(false);
    }
  };

  useEffect(() => {
    if (isLoading || !isSignedIn || !token.trim() || redeeming || redeemAttempted) return;
    setRedeemAttempted(true);
    void finishRedeem(token.trim());
  }, [isLoading, isSignedIn, token, redeeming, redeemAttempted]);

  const handleAuthSuccess = async () => {
    setShowSuccess(false);
    if (!token.trim()) {
      setError('This invite is no longer valid. Ask an admin for a new one.');
      return;
    }
    await finishRedeem(token.trim());
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setIssue(authIssue('missing_fields'));
      return;
    }
    cancelSignedOutRestart();
    setBusy(true);
    setIssue(null);
    setError(null);
    try {
      if (authMode === 'sign-up') {
        const outcome = await signUp({ email: email.trim(), password });
        markAuthEmailSent();
        if (outcome.needsConfirmation) {
          router.push({
            pathname: '/confirm-email',
            params: { email: outcome.email },
          } as never);
          return;
        }
      } else {
        await signIn({ email: email.trim(), password });
      }
      setShowSuccess(true);
    } catch (err) {
      if (authMode === 'sign-up' && isAuthRateLimitError(err)) {
        markAuthEmailSent();
      }
      if (isEmailNotConfirmedError(err)) {
        router.push({
          pathname: '/confirm-email',
          params: { email: email.trim() },
        } as never);
        return;
      }
      setIssue(resolveAuthIssue(err));
    } finally {
      setBusy(false);
    }
  };

  const handleApple = async () => {
    cancelSignedOutRestart();
    setIssue(null);
    setError(null);
    try {
      const session = await signInWithApple();
      await hydrateFromSession(session);
      setShowSuccess(true);
    } catch (err) {
      const resolved = resolveAuthIssue(err);
      if (resolved.code === 'apple_canceled') return;
      setIssue(resolved);
    }
  };

  if (isLoading) {
    return (
      <View style={[orbitScreen.container, styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (isSignedIn && !error && (redeeming || !redeemAttempted)) {
    return (
      <View style={[orbitScreen.container, styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {error ? (
          <Text style={[typography.body, { color: c.text, textAlign: 'center', paddingHorizontal: 24 }]}>
            {error}
          </Text>
        ) : (
          <>
            <ActivityIndicator color={c.text} />
            <Text style={[typography.footnote, { color: c.textMuted, marginTop: 12 }]}>Joining…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthShell
        showBack
        kicker="You're invited"
        title="Join your household"
        subtitle="Create an account or sign in — you'll connect immediately after.">
        <View style={{ gap: 14 }}>
          {error ? (
            <Text style={{ color: c.danger, fontSize: 14, textAlign: 'center' }}>{error}</Text>
          ) : null}

          <View style={styles.modeRow}>
            {(['sign-up', 'sign-in'] as const).map((mode) => {
              const active = authMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setAuthMode(mode);
                    setIssue(null);
                  }}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor: active ? `${accentTheme.primary}22` : orbitPalette.cardMuted,
                      borderColor: active ? `${accentTheme.primary}55` : orbitPalette.border,
                    },
                  ]}>
                  <Text style={{ color: active ? accentTheme.primary : c.textMuted, fontWeight: '700' }}>
                    {mode === 'sign-up' ? 'Create account' : 'Sign in'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {appleAvailable && Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                authMode === 'sign-up'
                  ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                  : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={16}
              style={styles.appleButton}
              onPress={() => void handleApple()}
            />
          ) : null}

          <OrbitInput
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (issue) setIssue(null);
            }}
          />
          <OrbitInput
            autoCapitalize="none"
            secureTextEntry
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (issue) setIssue(null);
            }}
          />
          <AuthErrorBanner
            issue={issue}
            actionParams={{ email: email.trim() }}
            onDismiss={() => setIssue(null)}
          />
          <OrbitButton disabled={busy || showSuccess} loading={busy} onPress={() => void handleEmailAuth()}>
            {busy ? 'Working…' : authMode === 'sign-up' ? 'Create & join' : 'Sign in & join'}
          </OrbitButton>
        </View>
      </AuthShell>
      <SignInSuccess visible={showSuccess} onDone={() => void handleAuthSuccess()} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  appleButton: { height: 48, width: '100%' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
});
