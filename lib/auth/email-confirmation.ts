import * as Linking from 'expo-linking';

import { getSupabaseClient } from '@/lib/supabase/client';

type PendingSignup = {
  email: string;
  password: string;
};

let pendingSignup: PendingSignup | null = null;

export function setPendingSignup(email: string, password: string) {
  pendingSignup = { email: email.trim(), password };
}

export function getPendingSignup(): PendingSignup | null {
  return pendingSignup;
}

export function clearPendingSignup() {
  pendingSignup = null;
}

/** Deep link target for Supabase email confirmation redirects. */
export function getEmailConfirmRedirectUrl() {
  return Linking.createURL('auth/callback');
}

function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  for (const part of [query, hash]) {
    if (!part) continue;
    for (const pair of part.split('&')) {
      const [rawKey, rawValue = ''] = pair.split('=');
      if (!rawKey) continue;
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
    }
  }
  return out;
}

/**
 * Establish a Supabase session from an email-confirm / magic-link redirect URL.
 * Supports implicit tokens (#access_token) and PKCE (?code=).
 */
export async function createSessionFromUrl(url: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const params = paramsFromUrl(url);
  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error || 'Email confirmation failed.');
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data.session;
  }

  return null;
}

export async function resendSignupConfirmation(email: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Live auth is not configured.');
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: {
      emailRedirectTo: getEmailConfirmRedirectUrl(),
    },
  });
  if (error) {
    throw new Error(error.message || 'Could not resend confirmation email.');
  }
}
