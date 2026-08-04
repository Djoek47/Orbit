import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { isEmailNotConfirmedError } from '@/lib/auth/auth-errors';
import {
  clearPendingSignup,
  getPendingSignup,
  getResendCooldownRemainingMs,
  resendSignupConfirmation,
} from '@/lib/auth/email-confirmation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { accentTheme, hydrateFromSession, orbitPalette, signIn } = useOrbit();
  const { c } = useOrbitColors();
  const pending = getPendingSignup();
  const email = useMemo(
    () => (typeof params.email === 'string' ? params.email : pending?.email ?? '').trim(),
    [params.email, pending?.email]
  );
  const [password, setPassword] = useState(pending?.password ?? '');
  const [showPassword, setShowPassword] = useState(!pending?.password);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    const tick = () => setCooldownSec(Math.ceil(getResendCooldownRemainingMs() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const finishOnboarding = async () => {
    clearPendingSignup();
    router.replace('/welcome' as never);
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return;
      try {
        const next = await import('@/repositories/auth-repository').then((m) =>
          m.authRepository.getCurrentSession()
        );
        if (next) {
          await hydrateFromSession(next);
          await finishOnboarding();
        }
      } catch {
        // stay on screen — user can tap Continue
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const handleResend = async () => {
    if (!email) {
      setError('Add the email you signed up with.');
      return;
    }
    setResending(true);
    setError('');
    setInfo('');
    try {
      await resendSignupConfirmation(email);
      setInfo('Confirmation email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend email.');
    } finally {
      setResending(false);
    }
  };

  const handleContinue = async () => {
    if (!email) {
      setError('Add the email you signed up with.');
      return;
    }
    const pwd = password.trim() || pending?.password || '';
    if (!pwd) {
      setShowPassword(true);
      setError('Enter your password to continue after confirming.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await signIn({ email, password: pwd });
      await finishOnboarding();
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        setError('Still waiting — open the link in your email, then try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Still waiting on confirmation.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      showBack
      brandHero
      kicker="Almost there"
      title="Confirm your email"
      subtitle={`We sent a confirmation link to ${email || 'your inbox'}. Open it on this phone, then continue.`}
      footer={
        <Pressable onPress={() => router.replace('/sign-in' as never)}>
          <Text style={[styles.link, { color: accentTheme.primary }]}>Back to sign in</Text>
        </Pressable>
      }>
      <View
        style={[
          styles.mailCard,
          {
            backgroundColor: orbitPalette.cardMuted,
            borderColor: orbitPalette.border,
          },
        ]}>
        <View style={[styles.mailIcon, { backgroundColor: `${accentTheme.primary}22` }]}>
          <MaterialIcons name="mark-email-unread" size={28} color={accentTheme.primary} />
        </View>
        <Text style={[styles.mailBody, { color: c.textMuted }]}>
          Tap the link in the email to verify. Leave Choremaxx open — we’ll continue when the link
          opens the app.
        </Text>
      </View>

      {showPassword ? (
        <OrbitInput
          autoCapitalize="none"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password you just created"
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <OrbitButton disabled={busy} onPress={() => void handleContinue()}>
        {busy ? 'Signing in…' : 'I’ve confirmed — continue'}
      </OrbitButton>

      <Pressable
        disabled={resending || cooldownSec > 0}
        onPress={() => void handleResend()}
        style={styles.resend}>
        <Text
          style={[
            styles.link,
            { color: cooldownSec > 0 ? c.textSubtle : accentTheme.primary },
          ]}>
          {resending
            ? 'Sending…'
            : cooldownSec > 0
              ? `Resend available in ${cooldownSec}s`
              : 'Resend confirmation email'}
        </Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  mailCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mailIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailBody: { fontSize: 14, lineHeight: 20 },
  error: { color: orbitColors.danger, fontSize: 13, fontWeight: '700' },
  info: { color: orbitColors.success, fontSize: 13, fontWeight: '600' },
  resend: { alignItems: 'center', paddingVertical: 4 },
  link: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
