import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  authIssue,
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
  checkEmailConfirmed,
} from '@/lib/auth/email-confirmation';
import {
  VERIFY_TIMEOUT_MS,
  confirmCheckMessage,
  createSingleFlight,
  isUserEmailConfirmed,
  normalizeOtpCode,
  withTimeout,
  type ConfirmCheckResult,
} from '@/lib/auth/confirm-callback';
import {
  goPremiumOnboardingOnce,
  premiumOnboardingHref,
} from '@/lib/billing/premium-onboarding';
import { shouldSkipPremiumForInvite } from '@/lib/billing/premium-invite';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cancelSignedOutRestart } from '@/lib/navigation/session-restart';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { accentTheme, hydrateFromSession, applyStashedInvite } = useOrbit();
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
  const finishingRef = useRef(false);

  useEffect(() => {
    cancelSignedOutRestart();
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

  const checkFlight = useRef(createSingleFlight<ConfirmCheckResult>()).current;
  const [checking, setChecking] = useState(false);

  const finishOnboarding = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearPendingSignup();
    try {
      const memberHref = await import('@/lib/invite/member-invite-token-store').then((m) =>
        m.memberInviteRedeemHref()
      );
      if (memberHref) {
        router.replace(memberHref as never);
        return;
      }
      const joined = await withTimeout(applyStashedInvite(), 8_000, 'invite timed out').catch(
        () => null
      );
      if (joined === 'active') {
        router.replace('/join-welcome' as never);
        return;
      }
      const skipPremium = await shouldSkipPremiumForInvite().catch(() => false);
      if (skipPremium) {
        router.replace('/join-welcome' as never);
        return;
      }
      const navigated = await goPremiumOnboardingOnce(() => {
        router.replace(premiumOnboardingHref({ source: 'onboarding' }) as never);
      }).catch(() => false);
      // Premium gate already seen (or lock held): never strand the user here — the root
      // router sends a signed-in user without a household to household setup.
      if (!navigated) router.replace('/' as never);
    } catch (err) {
      console.warn('confirm-email finishOnboarding', err);
      router.replace('/' as never);
    }
  };

  /** Signed in + confirmed: hydrate (bounded) and move on. Never waits on an auth listener. */
  const continueSignedIn = async () => {
    if (finishingRef.current) return;
    try {
      const next = await withTimeout(
        import('@/repositories/auth-repository').then((m) => m.authRepository.getCurrentSession()),
        8_000,
        'session timed out'
      );
      if (next) {
        await withTimeout(hydrateFromSession(next), 8_000, 'hydrate timed out').catch((e) =>
          console.warn('confirm-email hydrateFromSession', e)
        );
      }
    } catch (err) {
      console.warn('confirm-email continueSignedIn', err);
    }
    await finishOnboarding();
  };

  /** Shared by "Already confirmed", app-foreground and code-error fallbacks. Single-flight. */
  const runConfirmCheck = (silent: boolean) =>
    checkFlight.run(async () => {
      if (!silent) {
        setChecking(true);
        setIssue(null);
        setInfo('');
      }
      try {
        const pwd = password.trim() || getPendingSignup()?.password || '';
        const { result } = await withTimeout(
          checkEmailConfirmed(email, pwd),
          12_000,
          'check timed out'
        ).catch(() => ({ result: 'unknown' as ConfirmCheckResult }));
        if (result === 'confirmed') {
          setIssue(null);
          setInfo(confirmCheckMessage('confirmed'));
          cancelSignedOutRestart();
          await continueSignedIn();
        } else if (!silent) {
          if (result === 'unknown' && !pwd) setShowPassword(true);
          setInfo(
            result === 'unknown' && !pwd
              ? 'Enter your password above, then tap again — or use the code.'
              : confirmCheckMessage(result)
          );
        }
        return result;
      } finally {
        if (!silent) setChecking(false);
      }
    });

  // Confirmed in Safari/Chrome, then came back: re-check on foreground (and once on mount).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !finishingRef.current) void runConfirmCheck(true);
    });
    const t = setTimeout(() => void runConfirmCheck(true), 600);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; reads latest via getters
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // IMPORTANT: never await supabase.auth.* inside this callback. supabase-js runs it while
    // holding the auth lock, so awaiting getSession() here deadlocked verifyOtp/signIn —
    // the "Confirming…" / "Checking…" forever spinner. Defer to the next tick.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return;
      if (!isUserEmailConfirmed(session.user)) return;
      setTimeout(() => void continueSignedIn(), 0);
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
      await withTimeout(resendSignupConfirmation(email), 15_000, 'Sending timed out. Try again.');
      setInfo(`New email sent to ${email}. Check inbox and spam — use the newest one.`);
    } catch (err) {
      setIssue(resolveAuthIssue(err));
    } finally {
      setResending(false);
      setCooldownSec(Math.ceil(getResendCooldownRemainingMs() / 1000));
    }
  };

  const handleVerifyCode = async () => {
    if (busy) return;
    if (!email) {
      setIssue(authIssue('missing_fields', { message: 'Add the email you signed up with.' }));
      return;
    }
    const { code: cleaned, valid } = normalizeOtpCode(code);
    if (!valid) {
      setIssue(
        authIssue('missing_fields', {
          title: 'Enter your code',
          message: 'Use the 6–10 digit code from the confirmation email.',
        })
      );
      return;
    }

    setBusy(true);
    setIssue(null);
    setInfo('');
    try {
      let verified = false;
      try {
        const session = await withTimeout(
          verifySignupEmailOtp(email, cleaned),
          VERIFY_TIMEOUT_MS,
          'Confirmation timed out.'
        );
        verified = Boolean(session);
      } catch (err) {
        // Code rejected — but maybe the link already confirmed this account.
        const check = await runConfirmCheck(true).catch(() => 'unknown' as ConfirmCheckResult);
        if (check === 'confirmed') return;
        throw err;
      }
      if (!verified) {
        const check = await runConfirmCheck(true);
        if (check === 'confirmed') return;
        throw new Error('Could not verify that code.');
      }
      setInfo('Email confirmed. Continuing…');
      await continueSignedIn();
    } catch (err) {
      setIssue(resolveAuthIssue(err));
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = () => {
    if (!email) {
      setIssue(authIssue('missing_fields', { message: 'Add the email you signed up with.' }));
      return;
    }
    void runConfirmCheck(false);
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
      <View style={styles.stack}>
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
          <View accessibilityLiveRegion="polite">
            <Text style={[styles.info, { color: c.success }]}>{info}</Text>
          </View>
        ) : null}

        <OrbitButton disabled={busy || !normalizeOtpCode(code).valid} onPress={() => void handleVerifyCode()}>
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
          onPress={handleContinue}
          disabled={busy || checking}
          accessibilityRole="button"
          accessibilityState={{ busy: checking }}
          style={[styles.secondaryRow, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}
          hitSlop={6}>
          <MaterialIcons name="mark-email-read" size={20} color={c.textSoft} />
          <View style={styles.secondaryCopy}>
            <Text style={[styles.secondaryTitle, { color: c.text }]}>
              {checking ? 'Checking…' : 'Already confirmed'}
            </Text>
            <Text style={[styles.secondaryBody, { color: c.textMuted }]}>
              Continue if you already tapped the email link
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={c.textSubtle} />
        </Pressable>
      </View>
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
