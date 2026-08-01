import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { orbitColors } from '@/constants/orbit-theme';
import { clearPendingSignup, createSessionFromUrl } from '@/lib/auth/email-confirmation';
import { authRepository } from '@/repositories/auth-repository';
import { useOrbit } from '@/store/orbit-store';

/** Handles choremaxx://auth/callback after Supabase email confirmation. */
export default function AuthCallbackScreen() {
  const insets = useSafeAreaInsets();
  const { hydrateFromSession } = useOrbit();
  const [message, setMessage] = useState('Confirming your email…');
  const handled = useRef<string | null>(null);
  const url = Linking.useURL();

  useEffect(() => {
    let cancelled = false;

    const run = async (incoming: string | null) => {
      if (!incoming || handled.current === incoming) return;
      handled.current = incoming;
      try {
        const session = await createSessionFromUrl(incoming);
        if (cancelled) return;
        if (!session) {
          const existing = await authRepository.getCurrentSession();
          if (existing) {
            await hydrateFromSession(existing);
            clearPendingSignup();
            router.replace('/welcome' as never);
            return;
          }
          setMessage('Could not read the confirmation link. Try Resend from the confirm screen.');
          return;
        }
        const next = await authRepository.getCurrentSession();
        if (next) {
          await hydrateFromSession(next);
        }
        clearPendingSignup();
        router.replace('/welcome' as never);
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Confirmation failed.');
        }
      }
    };

    void run(url);
    void Linking.getInitialURL().then((initial) => {
      if (initial && initial !== url) void run(initial);
    });

    const sub = Linking.addEventListener('url', ({ url: next }) => {
      void run(next);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [hydrateFromSession, url]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <ChoremaxxLogo size="lg" />
      <ActivityIndicator color={orbitColors.primary} style={{ marginTop: 28 }} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070D1C',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  message: {
    color: orbitColors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
});
