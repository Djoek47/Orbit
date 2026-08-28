import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmailOtpType, Session } from '@supabase/supabase-js';

import { throwMappedAuthError } from '@/lib/auth/auth-errors';
import { paramsFromUrl } from '@/lib/auth/auth-url-params';
import { getSupabaseClient } from '@/lib/supabase/client';

export { paramsFromUrl, urlHasAuthPayload } from '@/lib/auth/auth-url-params';

type PendingSignup = {
  email: string;
  password: string;
};

const PENDING_SIGNUP_KEY = 'choremaxx.pendingSignup.v1';

/** HTTPS bridge on the marketing site — clickable in Mail; opens the app via Universal Link / page forward. */
export const EMAIL_CONFIRM_WEB_URL = 'https://www.choremaxx.app/auth/callback';

let pendingSignup: PendingSignup | null = null;
let pendingHydrated = false;

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
  void AsyncStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(pendingSignup)).catch(() => undefined);
}

export function getPendingSignup(): PendingSignup | null {
  return pendingSignup;
}

/** Load pending signup from disk (call once on confirm-email mount). */
export async function hydratePendingSignup(): Promise<PendingSignup | null> {
  if (pendingSignup) {
    pendingHydrated = true;
    return pendingSignup;
  }
  if (pendingHydrated) return null;
  pendingHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (!parsed?.email || !parsed?.password) return null;
    pendingSignup = { email: parsed.email.trim(), password: parsed.password };
    return pendingSignup;
  } catch {
    return null;
  }
}

export function clearPendingSignup() {
  pendingSignup = null;
  void AsyncStorage.removeItem(PENDING_SIGNUP_KEY).catch(() => undefined);
}

/**
 * Redirect target for Supabase Auth emails.
 * Prefer HTTPS so inbox clients treat the CTA as a real link (custom schemes often render as plain text).
 * Website `/auth/callback` forwards into `choremaxx://auth/callback?…`.
 */
export function getEmailConfirmRedirectUrl() {
  const override = process.env.EXPO_PUBLIC_EMAIL_CONFIRM_REDIRECT?.trim();
  if (override) return override;
  return EMAIL_CONFIRM_WEB_URL;
}

/** App deep link with the same query — used as a secondary fallback in email copy. */
export function getEmailConfirmAppUrl(tokenHash: string, type = 'signup') {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: type || 'signup',
  });
  return `choremaxx://auth/callback?${params.toString()}`;
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
export async function createSessionFromUrl(url: string): Promise<Session | null> {
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

/** Confirm signup with the numeric code from the email (“Or enter this code”). */
export async function verifySignupEmailOtp(email: string, token: string): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Live auth is not configured.');
  }
  const cleaned = token.replace(/\s+/g, '').trim();
  if (!cleaned) {
    throw new Error('Enter the code from your email.');
  }
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: cleaned,
    type: 'signup',
  });
  if (error) {
    throwMappedAuthError(error);
  }
  return data.session;
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
