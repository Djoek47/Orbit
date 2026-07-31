import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase/client';
import { mapProfileToUser } from '@/lib/mappers/orbit-mappers';
import type { AuthSession } from '@/types/orbit';

export async function isAppleAuthAvailable() {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AuthSession> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In did not return an identity token.');
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      user: {
        id: credential.user,
        email: credential.email ?? 'apple@orbit.app',
        name: name || 'Apple User',
        avatar: (name || 'A').charAt(0).toUpperCase(),
        profileComplete: Boolean(name),
      },
    };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error || !data.user) {
    const msg = (error?.message ?? '').toLowerCase();
    if (msg.includes('not enabled') || msg.includes('provider')) {
      throw new Error(
        'Sign in with Apple is not enabled on the server yet. Use email and password, or ask the admin to enable Apple in Supabase Auth.'
      );
    }
    throw new Error(error?.message ?? 'Apple Sign-In failed.');
  }

  const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (displayName) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email ?? credential.email ?? '',
      display_name: displayName,
      apple_sub: credential.user,
    });
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();

  return {
    user: mapProfileToUser({
      id: data.user.id,
      email: profile?.email ?? data.user.email ?? credential.email ?? '',
      display_name: profile?.display_name ?? (displayName || null),
      avatar_url: profile?.avatar_url ?? null,
    }),
  };
}
