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
  markPremiumGatePending,
  premiumOnboardingHref,
} from '@/lib/billing/premium-onboarding';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { authRepository } from '@/repositories/auth-repository';
import { useOrbit } from '@/store/orbit-store';

type Phase = 'working' | 'success' | 'needs_continue' | 'error';

const WAIT_FOR_LINK_MS = 3_500;
const VERIFY_TIMEOUT_MS = 12_000;
const SUCCESS_HOLD_MS = 900;

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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function AuthCallbackScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { hydrateFromSession, accentTheme } = useOrbit();
  const routeParams = useLocalSearchParams();
  const linkingUrl = Linking.useURL();
  const routeUrl = buildUrlFromParams(
    routeParams as Record<string, string | string[] | undefined>
  );

  const [phase, setPhase] = useState<Phase>('working');
  const [message, setMessage] = useState('Confirming your email…');
  const handled = useRef<string | null>(null);
  const finished = useRef(false);

  const goConfirmOrSignIn = () => {
    const email = getPendingSignup()?.email;
    if (email) {
      router.replace({ pathname: '/confirm-email', params: { email } } as never);
      return;
    }
    router.replace('/confirm-email' as never);
  };

  const finishSuccess = async () => {
    if (finished.current) return;
    finished.current = true;
    setPhase('success');
    setMessage('Email confirmed');
    clearPendingSignup();
    await markPremiumGatePending();
    await new Promise((r) => setTimeout(r, SUCCESS_HOLD_MS));
    router.replace(premiumOnboardingHref({ source: 'onboarding' }) as never);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async (incoming: string | null) => {
      if (cancelled || finished.current) return;
      if (!incoming) return;
      if (handled.current === incoming) return;

      // Bare callback with no auth payload — wait briefly for a richer URL event.
      if (!urlHasAuthPayload(incoming) && !incoming.includes('error')) {
        return;
      }

      handled.current = incoming;
      setPhase('working');
      setMessage('Confirming your email…');

      try {
        const session = await withTimeout(
          createSessionFromUrl(incoming),
          VERIFY_TIMEOUT_MS,
          'Confirmation timed out. Enter the code from your email instead.'
        );
        if (cancelled || finished.current) return;

        if (!session) {
          const existing = await authRepository.getCurrentSession();
          if (existing) {
            await hydrateFromSession(existing);
            await finishSuccess();
            return;
          }
          setPhase('needs_continue');
          setMessage(
            'Your email may already be confirmed. Continue to enter your code or sign in.'
          );
          return;
        }

        const next = await authRepository.getCurrentSession();
        if (next) {
          await hydrateFromSession(next);
        }
        await finishSuccess();
      } catch (err) {
        if (cancelled || finished.current) return;
        const text = err instanceof Error ? err.message : 'Confirmation failed.';
        const lower = text.toLowerCase();
        if (
          lower.includes('expired') ||
          lower.includes('invalid') ||
          lower.includes('already') ||
          lower.includes('otp') ||
          lower.includes('timed out')
        ) {
          setPhase('needs_continue');
          setMessage(
            lower.includes('timed out')
              ? text
              : 'This link was already used or expired. Enter the code from your email, or continue to sign in.'
          );
          return;
        }
        setPhase('error');
        setMessage(text);
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

    // Never leave the spinner orphaned — Chrome often opens a bare callback.
    const timer = setTimeout(() => {
      if (cancelled || finished.current || handled.current) return;
      void (async () => {
        const existing = await authRepository.getCurrentSession();
        if (cancelled || finished.current) return;
        if (existing) {
          try {
            await hydrateFromSession(existing);
            await finishSuccess();
            return;
          } catch {
            /* fall through */
          }
        }
        setPhase('needs_continue');
        setMessage(
          'Enter the code from your email, or tap Continue if you already confirmed.'
        );
      })();
    }, WAIT_FOR_LINK_MS);

    return () => {
      cancelled = true;
      sub.remove();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + url/params only
  }, [hydrateFromSession, linkingUrl, routeUrl]);

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
