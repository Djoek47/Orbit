import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { orbitScreen, typography } from '@/constants/orbit-theme';
import { consumeMemberInviteToken, peekMemberInviteToken } from '@/lib/invite/member-invite-token-store';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/**
 * Revision G §4 — one loading state, then Home for Sidekicks.
 * Adult tokens still land on pending-approval.
 */
export default function RedeemMemberInviteScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { c } = useOrbitColors();
  const { isSignedIn, isLoading, redeemMemberInviteToken, household } = useOrbit();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const token = typeof tokenParam === 'string' ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : '';

  useEffect(() => {
    if (isLoading || started) return;
    let cancelled = false;
    (async () => {
      const pending = token?.trim() || (await peekMemberInviteToken()) || '';
      if (!pending) {
        if (!cancelled) setError('This invite is no longer valid. Ask an admin for a new one.');
        return;
      }
      if (!isSignedIn) {
        const { stashMemberInviteToken } = await import('@/lib/invite/member-invite-token-store');
        await stashMemberInviteToken(pending);
        if (!cancelled) {
          router.replace(`/welcome?memberInvite=${encodeURIComponent(pending)}` as never);
        }
        return;
      }
      setStarted(true);
      try {
        const result = await redeemMemberInviteToken(pending);
        await consumeMemberInviteToken();
        if (cancelled) return;
        if (result.ok === false) {
          setError(result.message);
          return;
        }
        if (result.memberStatus === 'pending') {
          router.replace('/pending-approval' as never);
          return;
        }
        router.replace('/(tabs)' as never);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'This invite is no longer valid. Ask an admin for a new one.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isSignedIn, redeemMemberInviteToken, started, token]);

  if (!isSignedIn && !isLoading) {
    const pending = token?.trim();
    return (
      <Redirect
        href={
          (pending
            ? `/welcome?memberInvite=${encodeURIComponent(pending)}`
            : '/welcome') as never
        }
      />
    );
  }

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
          <Text style={[typography.title2, { color: c.text, marginTop: 16, textAlign: 'center' }]}>
            {household.householdName || 'Your household'}
          </Text>
          <Text style={[typography.footnote, { color: c.textMuted, marginTop: 8 }]}>Joining…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
});
