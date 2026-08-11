import * as Linking from 'expo-linking';
import type { EmailOtpType } from '@supabase/supabase-js';

import { throwMappedAuthError } from '@/lib/auth/auth-errors';
import { paramsFromUrl } from '@/lib/auth/auth-url-params';
import { getSupabaseClient } from '@/lib/supabase/client';

export { paramsFromUrl, urlHasAuthPayload } from '@/lib/auth/auth-url-params';

type PendingSignup = {
  email: string;
  password: string;
};

let pendingSignup: PendingSignup | null = null;

/** Client-side cooldown so resend / signup retries don't spam Auth email (Resend/SMTP). */
const RESEND_COOLDOWN_MS = 60_000;
let lastResendAt = 0;

const OTP_TYPES = new Set<string>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

export function getResendCooldownRemainingMs(now = Date.now()): number {
  return Math.max(0, lastResendAt + RESEND_COOLDOWN_MS - now);
}

export function markAuthEmailSent(now = Date.now()) {
  lastResendAt = now;
}

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

function otpTypeFromParam(raw: string | undefined): EmailOtpType {
  const value = (raw || 'signup').toLowerCase();
  if (OTP_TYPES.has(value)) return value as EmailOtpType;
  return 'signup';
}

/**
 * Establish a Supabase session from an email-confirm / magic-link redirect URL.
 * Supports:
 * - token_hash + type (preferred mobile deep link — no hash fragment)
 * - PKCE (?code=)
 * - implicit tokens (#access_token / query)
 */
export async function createSessionFromUrl(url: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const params = paramsFromUrl(url);
  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error || 'Email confirmation failed.');
  }

  if (params.token_hash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: otpTypeFromParam(params.type),
    });
    if (error) throw error;
    return data.session;
  }

  // Some clients pass `token` as the hash (hook token_hash).
  if (params.token && !params.code && !params.access_token) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: params.token,
      type: otpTypeFromParam(params.type),
    });
    if (error) throw error;
    return data.session;
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
  const remaining = getResendCooldownRemainingMs();
  if (remaining > 0) {
    const seconds = Math.ceil(remaining / 1000);
    throw new Error(`Wait ${seconds}s before requesting another confirmation email.`);
  }

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
  // Always start cooldown after an attempt so hammering doesn't deepen the project-wide limit.
  markAuthEmailSent();
  if (error) {
    throwMappedAuthError(error);
  }
}
