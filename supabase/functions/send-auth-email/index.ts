/**
 * Supabase Auth → Send Email Hook → Resend.
 *
 * Deploy with JWT verification disabled:
 *   npx supabase functions deploy send-auth-email --no-verify-jwt
 *
 * Secrets:
 *   RESEND_API_KEY
 *   SEND_EMAIL_HOOK_SECRET   (full value from Dashboard, e.g. v1,whsec_…)
 *   RESEND_FROM_EMAIL        (optional, default Choremaxx <noreply@choremaxx.app>)
 *
 * See docs/resend-auth-email.md
 */

import { Webhook } from 'npm:standardwebhooks@1.0.0';

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
  // Dashboard copies "v1,whsec_<base64>"; standardwebhooks wants the base64 part.
  return raw.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
}

function subjectFor(action: EmailActionType): string {
  switch (action) {
    case 'recovery':
      return 'Reset your Choremaxx password';
    case 'magiclink':
    case 'email':
      return 'Your Choremaxx sign-in link';
    case 'invite':
      return 'You’re invited to Choremaxx';
    case 'email_change':
      return 'Confirm your new Choremaxx email';
    case 'signup':
    default:
      return 'Confirm your Choremaxx email';
  }
}

function headlineFor(action: EmailActionType): string {
  switch (action) {
    case 'recovery':
      return 'Reset your password';
    case 'magiclink':
    case 'email':
      return 'Sign in to Choremaxx';
    case 'invite':
      return 'Join your household';
    case 'email_change':
      return 'Confirm your new email';
    case 'signup':
    default:
      return 'Confirm your email';
  }
}

function bodyFor(action: EmailActionType): string {
  switch (action) {
    case 'recovery':
      return 'Use the button below (or the code) to choose a new password. If you didn’t ask for this, you can ignore this email.';
    case 'magiclink':
    case 'email':
      return 'Tap the button below to finish signing in. The link expires soon.';
    case 'invite':
      return 'Someone invited you to a Choremaxx household. Confirm your email to continue.';
    case 'email_change':
      return 'Confirm this address to finish updating your Choremaxx account email.';
    case 'signup':
    default:
      return 'Thanks for joining Choremaxx. Confirm your email so your household can get started.';
  }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEmail(opts: {
  action: EmailActionType;
  confirmUrl: string;
  otp: string;
}): { html: string; text: string } {
  const headline = headlineFor(opts.action);
  const body = bodyFor(opts.action);
  const otp = opts.otp?.trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background:#0f1419;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e8eef4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1419;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#1a222c;border-radius:16px;padding:32px 28px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#8ba3b8;">Choremaxx</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:650;color:#f4f7fa;">${escapeHtml(headline)}</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#c5d0da;">${escapeHtml(body)}</p>
              <a href="${escapeHtml(opts.confirmUrl)}" style="display:inline-block;padding:14px 22px;background:#3d9bfd;color:#061018;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">Continue</a>
              ${
                otp
                  ? `<p style="margin:28px 0 0;font-size:14px;color:#8ba3b8;">Or enter this code:</p>
              <p style="margin:8px 0 0;font-size:28px;letter-spacing:0.2em;font-weight:700;color:#f4f7fa;">${escapeHtml(otp)}</p>`
                  : ''
              }
              <p style="margin:28px 0 0;font-size:12px;line-height:1.45;color:#6b7f90;">If the button doesn’t work, open this link:<br />
                <span style="word-break:break-all;color:#9eb4c6;">${escapeHtml(opts.confirmUrl)}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Choremaxx — ${headline}`,
    '',
    body,
    '',
    `Continue: ${opts.confirmUrl}`,
    otp ? `Code: ${otp}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
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
      email_data.redirect_to || ''
    );
    const { html, text } = renderEmail({
      action,
      confirmUrl,
      otp: email_data.token || '',
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
        subject: subjectFor(action),
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
