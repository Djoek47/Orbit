import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  authIssue,
  isEmailNotConfirmedError,
  resolveAuthIssue,
  type AuthIssue,
} from '@/lib/auth/auth-errors';
import {
  clearPendingSignup,
  getPendingSignup,
  getResendCooldownRemainingMs,
  hydratePendingSignup,
  resendSignupConfirmation,
  verifySignupEmailOtp,
} from '@/lib/auth/email-confirmation';
import {
  markPremiumGatePending,
  premiumOnboardingHref,
} from '@/lib/billing/premium-onboarding';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { accentTheme, hydrateFromSession, signIn } = useOrbit();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const [pendingPassword, setPendingPassword] = useState(getPendingSignup()?.password ?? '');
  const email = useMemo(
    () => (typeof params.email === 'string' ? params.email : getPendingSignup()?.email ?? '').trim(),
    [params.email, pendingPassword]
  );
  const [code, setCode] = useState('');
  const [password, setPassword] = useState(pendingPassword);
  const [showPassword, setShowPassword] = useState(!pendingPassword);
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    void hydratePendingSignup().then((pending) => {
      if (!pending) return;
      setPendingPassword(pending.password);
      setPassword(pending.password);
      setShowPassword(false);
    });
  }, []);

  useEffect(() => {
    const tick = () => setCooldownSec(Math.ceil(getResendCooldownRemainingMs() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const finishOnboarding = async () => {
    clearPendingSignup();
    await markPremiumGatePending();
    router.replace(premiumOnboardingHref({ source: 'onboarding' }) as never);
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
        // stay on screen — user can enter code or continue
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const handleResend = async () => {
    if (!email) {
      setIssue(authIssue('missing_fields', { message: 'Add the email you signed up with.' }));
      return;
    }
    setResending(true);
    setIssue(null);
    setInfo('');
    try {
      await resendSignupConfirmation(email);
      setInfo('New email sent. Check inbox and spam.');
    } catch (err) {
      setIssue(resolveAuthIssue(err));
    } finally {
      setResending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!email) {
      setIssue(authIssue('missing_fields', { message: 'Add the email you signed up with.' }));
      return;
    }
    const cleaned = code.replace(/\s+/g, '');
    if (cleaned.length < 6) {
      setIssue(
        authIssue('missing_fields', {
          title: 'Enter your code',
          message: 'Use the code from the confirmation email.',
        })
      );
      return;
    }

    setBusy(true);
    setIssue(null);
    try {
      const session = await verifySignupEmailOtp(email, cleaned);
      if (!session) {
        throw new Error('Could not verify that code.');
      }
      const next = await import('@/repositories/auth-repository').then((m) =>
        m.authRepository.getCurrentSession()
      );
      if (next) {
        await hydrateFromSession(next);
      }
      await finishOnboarding();
    } catch (err) {
      setIssue(resolveAuthIssue(err));
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = async () => {
    if (!email) {
      setIssue(authIssue('missing_fields', { message: 'Add the email you signed up with.' }));
      return;
    }
    const pwd = password.trim() || getPendingSignup()?.password || '';
    if (!pwd) {
      setShowPassword(true);
      setIssue(
        authIssue('missing_fields', {
          title: 'Password needed',
          message: 'Enter the password you created, then continue after confirming.',
        })
      );
      return;
    }

    setBusy(true);
    setIssue(null);
    try {
      await signIn({ email, password: pwd });
      await finishOnboarding();
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        setIssue(
          authIssue('email_not_confirmed', {
            title: 'Still waiting',
            message: 'Enter the code from your email, or tap the Confirm email link, then try again.',
            email,
          })
        );
      } else {
        setIssue(resolveAuthIssue(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      showBack
      brandHero
      title="Confirm your email"
      subtitle={
        email
          ? `We sent a link and a code to ${email}.`
          : 'We sent a link and a code to your inbox.'
      }
      footer={
        <Pressable onPress={() => router.replace('/sign-in' as never)} hitSlop={12}>
          <Text style={[styles.link, { color: accentTheme.primary }]}>Back to sign in</Text>
        </Pressable>
      }>
      <Animated.View entering={FadeIn.duration(280)} style={styles.stack}>
        <Text style={[typography.footnote, styles.hint, { color: c.textMuted }]}>
          Tap Confirm email in your inbox on this phone — or enter the code here.
        </Text>

        <View style={styles.codeBlock}>
          <Text style={[styles.codeLabel, { color: c.textMuted }]}>Confirmation code</Text>
          <TextInput
            accessibilityLabel="Confirmation code"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            maxLength={12}
            onChangeText={(value) => setCode(value.replace(/[^\d]/g, ''))}
            placeholder="••••••••"
            placeholderTextColor={c.textSubtle}
            style={[
              styles.codeInput,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
                borderColor: glassBorder(0.12),
                color: c.text,
              },
            ]}
            textContentType="oneTimeCode"
            value={code}
          />
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

        <AuthErrorBanner issue={issue} actionParams={{ email }} onDismiss={() => setIssue(null)} />
        {info ? (
          <Animated.View entering={FadeInUp.duration(220)}>
            <Text style={[styles.info, { color: c.success }]}>{info}</Text>
          </Animated.View>
        ) : null}

        <OrbitButton disabled={busy || code.length < 6} onPress={() => void handleVerifyCode()}>
          {busy ? 'Confirming…' : 'Confirm with code'}
        </OrbitButton>

        <Pressable
          disabled={resending || cooldownSec > 0}
          onPress={() => void handleResend()}
          style={styles.resend}
          hitSlop={10}>
          <Text
            style={[
              styles.link,
              { color: cooldownSec > 0 ? c.textSubtle : accentTheme.primary },
            ]}>
            {resending
              ? 'Sending…'
              : cooldownSec > 0
                ? `Resend available in ${cooldownSec}s`
                : 'Resend email'}
          </Text>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: glassBorder(0.08) }]} />

        <Pressable
          onPress={() => void handleContinue()}
          disabled={busy}
          style={[styles.secondaryRow, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}
          hitSlop={6}>
          <MaterialIcons name="mark-email-read" size={20} color={c.textSoft} />
          <View style={styles.secondaryCopy}>
            <Text style={[styles.secondaryTitle, { color: c.text }]}>
              {busy ? 'Checking…' : 'Already confirmed'}
            </Text>
            <Text style={[styles.secondaryBody, { color: c.textMuted }]}>
              Continue if you already tapped the email link
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={c.textSubtle} />
        </Pressable>
      </Animated.View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: space.md,
  },
  hint: {
    lineHeight: 20,
    marginBottom: 4,
  },
  codeBlock: {
    gap: space.xs,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  codeInput: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    minHeight: 64,
    paddingHorizontal: space.lg,
    textAlign: 'center',
  },
  info: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  resend: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: space.xs,
  },
  secondaryRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  secondaryCopy: {
    flex: 1,
    gap: 2,
  },
  secondaryTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBody: {
    fontSize: 13,
    lineHeight: 18,
  },
});
