/**
 * Accept household ownership transfer from a scanned QR / deep link.
 * Empty accounts only (or recoverable scheduled-delete shells).
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { FrostedPanel } from '@/components/orbit/frosted-panel';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import {
  authIssue,
  isAuthRateLimitError,
  isEmailNotConfirmedError,
  resolveAuthIssue,
  userFacingMessage,
  type AuthIssue,
} from '@/lib/auth/auth-errors';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { markAuthEmailSent } from '@/lib/auth/email-confirmation';
import { isMockMode } from '@/repositories/repository-utils';
import {
  emptyAccountTransferMessage,
  isEmptyAccountForTransfer,
} from '@/lib/household/household-transfer';
import { acceptHouseholdTransfer } from '@/lib/household/send-household-transfer';
import { cancelSignedOutRestart } from '@/lib/navigation/session-restart';
import { orbitScreen, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function AcceptHouseholdTransferScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { c } = useOrbitColors();
  const {
    accentTheme,
    currentUser,
    householdMemberships,
    hydrateFromSession,
    isLoading,
    isSignedIn,
    orbitPalette,
    signIn,
    signUp,
    switchHousehold,
    applyMockHouseholdTransfer,
  } = useOrbit();

  const paramToken =
    typeof tokenParam === 'string' ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : '';
  const token = (paramToken ?? '').trim();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');

  const memberships = useMemo(
    () =>
      householdMemberships.map((m) => ({
        householdId: m.householdId,
        householdName: m.householdName,
        role: m.role,
        status: m.status,
        deletionScheduledFor: m.deletionScheduledFor,
      })),
    [householdMemberships]
  );

  const eligibleLocal = isEmptyAccountForTransfer(memberships);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const finishAccept = async (xferToken: string) => {
    const user = currentUser;
    if (!user?.id) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await acceptHouseholdTransfer({
        token: xferToken,
        userId: user.id,
        memberships,
        mock: isMockMode(),
        onMockAccept: async (householdId) => {
          await applyMockHouseholdTransfer(householdId);
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        await switchHousehold(result.householdId);
      } catch {
        /* may already be active */
      }
      router.replace('/(tabs)' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not complete the transfer.'));
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    if (isLoading || !isSignedIn || !token || accepting || attempted) return;
    if (!eligibleLocal) {
      setError(emptyAccountTransferMessage());
      setAttempted(true);
      return;
    }
    setAttempted(true);
    void finishAccept(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isSignedIn, token, accepting, attempted, eligibleLocal, currentUser?.id]);

  if (!token) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (isLoading || (isSignedIn && accepting && !error)) {
    return (
      <View style={[orbitScreen.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={accentTheme.primary} />
        <Text style={[typography.body, { color: c.textMuted }]}>Taking ownership…</Text>
      </View>
    );
  }

  if (isSignedIn && error) {
    return (
      <AuthShell title="Transfer ownership" subtitle="This QR code moves a household to your account.">
        <Stack.Screen options={{ headerShown: false }} />
        <FrostedPanel borderColor={`${accentTheme.primary}33`} style={styles.errorCard}>
          <View style={[styles.errorIcon, { backgroundColor: 'rgba(248,113,113,0.14)' }]}>
            <MaterialIcons name="qr-code-2" size={26} color="#F87171" />
          </View>
          <Text style={[typography.title3, { color: c.text, textAlign: 'center' }]}>
            Couldn’t complete the transfer
          </Text>
          <Text style={[typography.body, { color: c.textMuted, textAlign: 'center', lineHeight: 22 }]}>
            {error}
          </Text>
        </FrostedPanel>
        {eligibleLocal ? (
          <OrbitButton
            onPress={() => {
              setAttempted(false);
              setError(null);
            }}>
            Try again
          </OrbitButton>
        ) : null}
        <OrbitButton tone="secondary" onPress={() => router.replace('/welcome' as never)}>
          Back to welcome
        </OrbitButton>
      </AuthShell>
    );
  }

  if (isSignedIn) {
    return (
      <View style={[orbitScreen.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={accentTheme.primary} />
      </View>
    );
  }

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
      setAttempted(false);
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
      setAttempted(false);
    } catch (err) {
      const resolved = resolveAuthIssue(err);
      if (resolved.code === 'apple_canceled') return;
      setIssue(resolved);
    }
  };

  return (
    <AuthShell
      title="Take ownership"
      subtitle="Create or sign in on an empty account, then this household becomes yours.">
      <Stack.Screen options={{ headerShown: false }} />
      {issue ? <AuthErrorBanner issue={issue} /> : null}
      {error ? (
        <Text style={[typography.footnote, { color: c.danger ?? '#F87171' }]}>{error}</Text>
      ) : null}
      <View style={styles.modeRow}>
        <Pressable onPress={() => setAuthMode('sign-up')}>
          <Text
            style={{
              color: authMode === 'sign-up' ? accentTheme.primary : orbitPalette.textMuted,
              fontWeight: '700',
            }}>
            New account
          </Text>
        </Pressable>
        <Text style={{ color: orbitPalette.textSubtle }}>·</Text>
        <Pressable onPress={() => setAuthMode('sign-in')}>
          <Text
            style={{
              color: authMode === 'sign-in' ? accentTheme.primary : orbitPalette.textMuted,
              fontWeight: '700',
            }}>
            Sign in
          </Text>
        </Pressable>
      </View>
      <OrbitInput
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="you@email.com"
        value={email}
      />
      <OrbitInput
        label="Password"
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        value={password}
      />
      <OrbitButton disabled={busy} onPress={() => void handleEmailAuth()}>
        {busy ? 'Working…' : authMode === 'sign-up' ? 'Create empty account' : 'Sign in'}
      </OrbitButton>
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={14}
          style={{ height: 48, width: '100%' }}
          onPress={() => void handleApple()}
        />
      ) : null}
      <Text style={[typography.footnote, { color: orbitPalette.textMuted, textAlign: 'center' }]}>
        {emptyAccountTransferMessage()}
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorCard: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  errorIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 4,
    width: 52,
  },
  modeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 4,
  },
});
