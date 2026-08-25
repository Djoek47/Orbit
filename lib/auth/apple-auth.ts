import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { isProfileNameComplete } from '@/lib/auth/display-name';
import { throwAuthIssue, throwMappedAuthError } from '@/lib/auth/auth-errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { mapProfileToUser } from '@/lib/mappers/orbit-mappers';
import type { AuthSession } from '@/types/orbit';

export async function isAppleAuthAvailable() {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
}

function appleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null | undefined
): string {
  return [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim();
}

export async function signInWithApple(): Promise<AuthSession> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throwAuthIssue('generic', { message: 'Apple Sign-In did not finish. Try email and password instead.' });
  }

  const appleName = appleFullName(credential.fullName);
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      user: {
        id: credential.user,
        email: credential.email ?? 'apple@orbit.app',
        name: appleName || 'Apple User',
        avatar: (appleName || 'A').charAt(0).toUpperCase(),
        profileComplete: isProfileNameComplete(appleName || 'Apple User', credential.email),
      },
    };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error || !data.user) {
    const msg = (error?.message ?? '').toLowerCase();
    if (
      msg.includes('not enabled') ||
      msg.includes('not installed') ||
      msg.includes('provider') ||
      msg.includes('appleid.apple.com')
    ) {
      throwAuthIssue('apple_unavailable');
    }
    throwMappedAuthError(error ?? { message: 'Apple Sign-In failed.' });
  }

  const email = data.user.email ?? credential.email ?? '';

  // Apple only returns fullName on first authorization — overwrite the
  // trigger-seeded relay local-part whenever we get a real name.
  if (appleName) {
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      display_name: appleName,
      apple_sub: credential.user,
    });
    if (upsertError) {
      console.warn('apple-auth: display_name upsert failed', upsertError.message);
    }
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  const resolvedName = appleName || profile?.display_name?.trim() || '';

  return {
    user: mapProfileToUser({
      id: data.user.id,
      email: profile?.email ?? email,
      display_name: resolvedName || null,
      avatar_url: profile?.avatar_url ?? null,
    }),
  };
}
