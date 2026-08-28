/**
 * Email confirmation landing — Apple-calm state machine.
 * Never spins forever: success, error, or continue path within a few seconds.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  clearPendingSignup,
  createSessionFromUrl,
  getPendingSignup,
  urlHasAuthPayload,
} from '@/lib/auth/email-confirmation';
import {
  WALL_CLOCK_MS,
  WAIT_FOR_LINK_MS,
  VERIFY_TIMEOUT_MS,
  SUCCESS_HOLD_MS,
  classifyConfirmError,
  createConfirmController,
  shouldResumeSignedInOnConfirmLink,
  withTimeout,
} from '@/lib/auth/confirm-callback';
import {
  markPremiumGatePending,
  premiumOnboardingHref,
} from '@/lib/billing/premium-onboarding';
import { shouldSkipPremiumForInvite } from '@/lib/billing/premium-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { authRepository } from '@/repositories/auth-repository';
import { useOrbit } from '@/store/orbit-store';

type Phase = 'working' | 'success' | 'needs_continue' | 'error';

function buildUrlFromParams(params: Record<string, string | string[] | undefined>): string | null {
  const pick = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const tokenHash = pick('token_hash') ?? pick('token');
  const type = pick('type') ?? 'signup';
  const code = pick('code');
  const access = pick('access_token');
  const refresh = pick('refresh_token');
  const error = pick('error');
  const errorDescription = pick('error_description');

  if (!tokenHash && !code && !access && !error && !errorDescription) return null;

  const q = new URLSearchParams();
  if (tokenHash) q.set('token_hash', tokenHash);
  if (type) q.set('type', type);
  if (code) q.set('code', code);
  if (access) q.set('access_token', access);
  if (refresh) q.set('refresh_token', refresh);
  if (error) q.set('error', error);
  if (errorDescription) q.set('error_description', errorDescription);
  return `choremaxx://auth/callback?${q.toString()}`;
}

export default function AuthCallbackScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { hydrateFromSession, accentTheme, applyStashedInvite } = useOrbit();
  const routeParams = useLocalSearchParams();
  const linkingUrl = Linking.useURL();
  const routeUrl = buildUrlFromParams(
    routeParams as Record<string, string | string[] | undefined>
  );

  const [phase, setPhase] = useState<Phase>('working');
  const [message, setMessage] = useState('Confirming your email…');
  const controllerRef = useRef(createConfirmController());
  const hydrateRef = useRef(hydrateFromSession);
  hydrateRef.current = hydrateFromSession;

  const goConfirmOrSignIn = () => {
    const email = getPendingSignup()?.email;
    if (email) {
      router.replace({ pathname: '/confirm-email', params: { email } } as never);
      return;
    }
    router.replace('/confirm-email' as never);
  };

  const finishSuccess = async () => {
    const controller = controllerRef.current;
    if (controller.finished) return;
    controller.markFinished();
    setPhase('success');
    setMessage('Email confirmed');
    clearPendingSignup();
    const memberHref = await import('@/lib/invite/member-invite-token-store').then((m) =>
      m.memberInviteRedeemHref()
    );
    if (memberHref) {
      router.replace(memberHref as never);
      return;
    }
    const joined = await applyStashedInvite();
    await new Promise((r) => setTimeout(r, SUCCESS_HOLD_MS));
    if (joined === 'pending') {
      router.replace('/pending-approval' as never);
      return;
    }
    if (joined === 'active') {
      router.replace('/join-welcome' as never);
      return;
    }
    const skipPremium = await shouldSkipPremiumForInvite();
    if (skipPremium) {
      router.replace('/join-welcome' as never);
      return;
    }
    await markPremiumGatePending();
    router.replace(premiumOnboardingHref({ source: 'onboarding' }) as never);
  };

  const enterSignedInApp = async (session: Parameters<typeof hydrateFromSession>[0]) => {
    const controller = controllerRef.current;
    if (controller.finished) return;
    controller.markFinished();
    await hydrateQuietly(session);
    setPhase('success');
    setMessage("You're in");
    const memberHref = await import('@/lib/invite/member-invite-token-store').then((m) =>
      m.memberInviteRedeemHref()
    );
    if (memberHref) {
      router.replace(memberHref as never);
      return;
    }
    const joined = await applyStashedInvite();
    await new Promise((r) => setTimeout(r, SUCCESS_HOLD_MS));
    if (joined === 'pending') {
      router.replace('/pending-approval' as never);
      return;
    }
    router.replace('/');
  };

  const hydrateQuietly = async (session: Parameters<typeof hydrateFromSession>[0]) => {
    try {
      await withTimeout(
        hydrateRef.current(session),
        VERIFY_TIMEOUT_MS,
        'Confirmation timed out. Enter the code from your email instead.'
      );
    } catch (error) {
      console.warn('auth/callback hydrateFromSession', error);
    }
  };

  const escapeWorking = async (copy: string) => {
    const controller = controllerRef.current;
    if (!controller.canEscape()) return;
    try {
      const existing = await withTimeout(
        authRepository.getCurrentSession(),
        4_000,
        'Confirmation timed out. Enter the code from your email instead.'
      );
      if (existing) {
        await enterSignedInApp(existing);
        return;
      }
    } catch {
      /* fall through to continue */
    }
    if (!controller.canEscape()) return;
    controller.markFinished();
    setPhase('needs_continue');
    setMessage(copy);
  };

  useEffect(() => {
    const wall = setTimeout(() => {
      void escapeWorking(
        'Enter the code from your email, or tap Continue if you already confirmed.'
      );
    }, WALL_CLOCK_MS);
    return () => clearTimeout(wall);
    // Wall clock is mount-only — must fire even if verify already started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;

    const run = async (incoming: string | null) => {
      if (controller.finished) return;
      if (!incoming) return;

      if (!urlHasAuthPayload(incoming) && !incoming.includes('error')) {
        return;
      }

      if (!controller.shouldStartVerify(incoming)) return;
      controller.markVerifyStarted(incoming);
      setPhase('working');
      setMessage('Confirming your email…');

      try {
        const existingUpFront = await withTimeout(
          authRepository.getCurrentSession(),
          4_000,
          'Confirmation timed out. Enter the code from your email instead.'
        );
        if (shouldResumeSignedInOnConfirmLink(Boolean(existingUpFront)) && existingUpFront) {
          await enterSignedInApp(existingUpFront);
          return;
        }

        const session = await withTimeout(
          createSessionFromUrl(incoming),
          VERIFY_TIMEOUT_MS,
          'Confirmation timed out. Enter the code from your email instead.'
        );
        // Do not drop success because the effect remounted.
        if (controller.finished) return;

        if (!session) {
          const existing = await withTimeout(
            authRepository.getCurrentSession(),
            4_000,
            'Confirmation timed out. Enter the code from your email instead.'
          );
          if (existing) {
            await enterSignedInApp(existing);
            return;
          }
          if (controller.finished) return;
          controller.markFinished();
          setPhase('needs_continue');
          setMessage(
            'Your email may already be confirmed. Continue to enter your code or sign in.'
          );
          return;
        }

        const next = await withTimeout(
          authRepository.getCurrentSession(),
          4_000,
          'Confirmation timed out. Enter the code from your email instead.'
        );
        if (next) {
          await hydrateQuietly(next);
        }
        await finishSuccess();
      } catch (err) {
        if (controller.finished) return;
        try {
          const existing = await authRepository.getCurrentSession();
          if (existing) {
            await enterSignedInApp(existing);
            return;
          }
        } catch {
          /* show continue if we cannot read a session */
        }
        const classified = classifyConfirmError(err);
        controller.markFinished();
        setPhase(classified.phase);
        setMessage(classified.message);
      }
    };

    void run(routeUrl);
    void run(linkingUrl);
    void Linking.getInitialURL().then((initial) => {
      if (initial) void run(initial);
    });

    const sub = Linking.addEventListener('url', ({ url: next }) => {
      void run(next);
    });

    const timer = setTimeout(() => {
      if (controller.finished || controller.verifyStarted) return;
      void escapeWorking(
        'Enter the code from your email, or tap Continue if you already confirmed.'
      );
    }, WAIT_FOR_LINK_MS);

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
    // hydrateFromSession is read via ref so store identity changes cannot cancel verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkingUrl, routeUrl]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + space.xxl,
          paddingBottom: Math.max(insets.bottom, space.lg),
          backgroundColor: c.background,
        },
      ]}>
      <Animated.View entering={FadeIn.duration(280)} style={styles.brand}>
        <ChoremaxxLogo size="lg" />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80).duration(320)} style={styles.center}>
        {phase === 'working' ? (
          <ActivityIndicator color={accentTheme.primary} size="large" />
        ) : null}

        {phase === 'success' ? (
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: `${c.success}22`, borderColor: `${c.success}44` },
            ]}>
            <MaterialIcons name="check" size={32} color={c.success} />
          </View>
        ) : null}

        {phase === 'needs_continue' || phase === 'error' ? (
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor: glass(0.06),
                borderColor: glassBorder(0.1),
              },
            ]}>
            <MaterialIcons
              name={phase === 'error' ? 'error-outline' : 'mark-email-read'}
              size={28}
              color={phase === 'error' ? c.danger ?? accentTheme.primary : c.textSoft}
            />
          </View>
        ) : null}

        <Text
          style={[
            typography.title3,
            {
              color: c.text,
              textAlign: 'center',
              fontWeight: '700',
              marginTop: space.lg,
            },
          ]}>
          {phase === 'success'
            ? "You're in"
            : phase === 'error'
              ? "Couldn't confirm"
              : phase === 'needs_continue'
                ? 'One more step'
                : 'Confirming'}
        </Text>
        <Text style={[typography.body, styles.message, { color: c.textMuted }]}>{message}</Text>
      </Animated.View>

      {phase === 'needs_continue' || phase === 'error' ? (
        <Animated.View entering={FadeInUp.delay(120).duration(280)} style={styles.actions}>
          <OrbitButton onPress={goConfirmOrSignIn}>Enter code</OrbitButton>
          <Pressable onPress={() => router.replace('/sign-in' as never)} hitSlop={12}>
            <Text style={[typography.subheadline, { color: accentTheme.primary, fontWeight: '600' }]}>
              Sign in instead
            </Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.actions} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space.xl,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  statusIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  message: {
    marginTop: space.sm,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  actions: {
    gap: space.md,
    alignItems: 'center',
    minHeight: 96,
  },
});
