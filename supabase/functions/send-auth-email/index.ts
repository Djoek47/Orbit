/**
 * Supabase Auth → Send Email Hook → Resend (branded React Email templates).
 *
 * Deploy with JWT verification disabled:
 *   npx supabase functions deploy send-auth-email --no-verify-jwt
 *
 * Secrets:
 *   RESEND_API_KEY
 *   SEND_EMAIL_HOOK_SECRET   (full value from Dashboard, e.g. v1,whsec_…)
 *   RESEND_FROM_EMAIL        (optional, default Choremaxx <noreply@choremaxx.app>)
 *
 * Templates: emails/verification | password-reset | magic-link | email-changed
 * See docs/resend-auth-email.md and docs/email-templates.md
 */

import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { render as renderToHtml } from 'npm:@react-email/render@2.1.0';
import * as React from 'npm:react@19.1.0';

import EmailChangedEmail, {
  subjectFor as emailChangedSubject,
  textFor as emailChangedText,
} from '../../../emails/email-changed.tsx';
import MagicLinkEmail, {
  subjectFor as magicLinkSubject,
  textFor as magicLinkText,
} from '../../../emails/magic-link.tsx';
import PasswordResetEmail, {
  subjectFor as passwordResetSubject,
  textFor as passwordResetText,
} from '../../../emails/password-reset.tsx';
import VerificationEmail, {
  subjectFor as verificationSubject,
  textFor as verificationText,
} from '../../../emails/verification.tsx';

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

function appendOtp(
  rendered: { subject: string; html: string; text: string },
  otp: string
): { subject: string; html: string; text: string } {
  const code = otp.trim();
  if (!code) return rendered;
  return {
    ...rendered,
    text: `${rendered.text}\n\nOr enter this code: ${code}`,
    html: rendered.html.replace(
      /<\/body>/i,
      `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#8A7A70;text-align:center;margin:24px 16px;">Or enter this code: <strong style="letter-spacing:0.12em;color:#712B13;">${code}</strong></p></body>`
    ),
  };
}

async function renderBrandedEmail(opts: {
  action: EmailActionType;
  confirmUrl: string;
  name: string;
  otp: string;
  oldEmail?: string;
  newEmail?: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const { action, confirmUrl, name } = opts;

  let subject: string;
  let html: string;
  let text: string;

  switch (action) {
    case 'recovery': {
      const props = { name, resetUrl: confirmUrl, expiresInMinutes: 60 };
      subject = passwordResetSubject(props);
      html = await renderToHtml(React.createElement(PasswordResetEmail, props));
      text = passwordResetText(props);
      break;
    }
    case 'magiclink':
    case 'email': {
      const props = { name, signInUrl: confirmUrl, expiresInMinutes: 15 };
      subject = magicLinkSubject(props);
      html = await renderToHtml(React.createElement(MagicLinkEmail, props));
      text = magicLinkText(props);
      break;
    }
    case 'email_change': {
      const props = {
        name,
        oldEmail: opts.oldEmail?.trim() || 'previous address',
        newEmail: opts.newEmail?.trim() || name,
        confirmUrl,
      };
      subject = emailChangedSubject(props);
      html = await renderToHtml(React.createElement(EmailChangedEmail, props));
      text = emailChangedText(props);
      break;
    }
    case 'signup':
    case 'invite':
    default: {
      const props = { name, confirmUrl, expiresInHours: 24 };
      subject = verificationSubject();
      html = await renderToHtml(React.createElement(VerificationEmail, props));
      text = verificationText(props);
      break;
    }
  }

  return appendOtp({ subject, html, text }, opts.otp);
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
    const { subject, html, text } = await renderBrandedEmail({
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
