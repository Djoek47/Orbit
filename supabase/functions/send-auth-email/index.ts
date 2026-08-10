/**
 * Supabase Auth → Send Email Hook → Resend (branded HTML).
 *
 * Deploy with JWT verification disabled:
 *   npx supabase functions deploy send-auth-email --no-verify-jwt
 *
 * Secrets:
 *   RESEND_API_KEY
 *   SEND_EMAIL_HOOK_SECRET   (full value from Dashboard, e.g. v1,whsec_…)
 *   RESEND_FROM_EMAIL        (optional, default Choremaxx <noreply@choremaxx.app>)
 *
 * Brand HTML lives in ./branded-html.ts (must stay inside this folder for deploy).
 * Node preview templates remain in repo-root emails/*.tsx.
 *
 * See docs/resend-auth-email.md
 */

import { Webhook } from 'npm:standardwebhooks@1.0.0';

import { renderBrandedAuthEmail } from './branded-html.ts';

type EmailActionType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'
  | string;

type HookPayload = {
  user: {
    email?: string;
    user_metadata?: Record<string, unknown>;
    email_new?: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';

function stripHookSecret(raw: string): string {
  return raw.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
}

function displayName(email: string, meta?: Record<string, unknown>): string {
  const fromMeta =
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.name === 'string' && meta.name) ||
    (typeof meta?.display_name === 'string' && meta.display_name) ||
    '';
  if (fromMeta.trim()) return fromMeta.trim();
  const local = email.split('@')[0]?.trim();
  return local || 'there';
}

function verifyUrl(
  supabaseUrl: string,
  tokenHash: string,
  type: EmailActionType,
  redirectTo: string
): string {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', type);
  if (redirectTo) {
    url.searchParams.set('redirect_to', redirectTo);
  }
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const hookSecretRaw = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!resendKey || !hookSecretRaw || !supabaseUrl) {
    console.error('send-auth-email: missing RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET, or SUPABASE_URL');
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: 'Email provider is not configured',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(stripHookSecret(hookSecretRaw));

  try {
    const { user, email_data } = wh.verify(payload, headers) as HookPayload;
    const to = user.email?.trim();
    if (!to) {
      throw Object.assign(new Error('Missing user email'), { code: 400 });
    }

    const action = email_data.email_action_type || 'signup';
    const confirmUrl = verifyUrl(
      supabaseUrl,
      email_data.token_hash,
      action,
      email_data.redirect_to || 'choremaxx://auth/callback'
    );
    const name = displayName(to, user.user_metadata);
    const { subject, html, text } = renderBrandedAuthEmail({
      action,
      confirmUrl,
      name,
      otp: email_data.token || '',
      oldEmail: to,
      newEmail: typeof user.email_new === 'string' ? user.email_new : to,
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend error', res.status, detail);
      throw Object.assign(new Error(`Resend failed (${res.status})`), { code: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code =
      typeof error === 'object' && error && 'code' in error && typeof (error as { code: unknown }).code === 'number'
        ? (error as { code: number }).code
        : 401;
    console.error('send-auth-email failed', message);
    return new Response(
      JSON.stringify({
        error: {
          http_code: code,
          message,
        },
      }),
      {
        status: code === 502 || code === 500 || code === 400 ? code : 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
