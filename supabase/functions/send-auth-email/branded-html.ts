/**
 * Branded Auth email HTML for Edge deploy.
 * Kept inside this function folder so `supabase functions deploy` bundles it
 * (imports from repo-root `emails/` are not uploaded by the remote bundler).
 *
 * Visual tokens match `emails/theme.ts` (coral / cream ChoreMaxx).
 * Node preview/tests still use `emails/*.tsx` + `emails/auth-hook-render.ts`.
 */

export type AuthEmailAction =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'
  | string;

const COLORS = {
  coral: '#D85A30',
  darkText: '#712B13',
  body: '#3A2E28',
  muted: '#8A7A70',
  bg: '#F7F4F2',
  card: '#FFFFFF',
  divider: '#ECE6E2',
};

const LOGO_URL = 'https://choremaxx.vercel.app/emails/logo-mark.png';
const SUPPORT = 'support@choremaxx.app';
const PRIVACY = 'https://choremaxx.vercel.app/privacy';
const TERMS = 'https://choremaxx.vercel.app/terms';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name || 'there';
}

type Content = {
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  confirmUrl: string;
  footnote?: string;
  rows?: { label: string; value: string }[];
};

function contentFor(input: {
  action: AuthEmailAction;
  name: string;
  confirmUrl: string;
  oldEmail?: string;
  newEmail?: string;
}): Content {
  const name = firstName(input.name);
  switch (input.action) {
    case 'recovery':
      return {
        subject: 'Reset your password',
        headline: 'Reset your password',
        body: `Hi ${name}, we received a request to reset your ChoreMaxx password. Tap the button below to choose a new one.`,
        ctaLabel: 'Reset Password',
        confirmUrl: input.confirmUrl,
        footnote: 'Link expires in 60 minutes. If you did not request this, you can ignore this email.',
      };
    case 'magiclink':
    case 'email':
      return {
        subject: 'Your ChoreMaxx sign-in link',
        headline: 'Sign in to ChoreMaxx',
        body: `Hi ${name}, tap the button below to sign in. No password needed.`,
        ctaLabel: 'Sign In',
        confirmUrl: input.confirmUrl,
        footnote: 'Link expires in 15 minutes.',
      };
    case 'email_change':
      return {
        subject: 'Confirm your new ChoreMaxx email',
        headline: 'Confirm your new email',
        body: `Hi ${name}, confirm this address to finish updating your ChoreMaxx account email.`,
        ctaLabel: 'Confirm new email',
        confirmUrl: input.confirmUrl,
        footnote: `If you did not request this, contact ${SUPPORT}.`,
        rows: [
          { label: 'Previous email', value: input.oldEmail || 'previous address' },
          { label: 'New email', value: input.newEmail || input.name },
        ],
      };
    case 'signup':
    case 'invite':
    default:
      return {
        subject: 'Verify your ChoreMaxx account',
        headline: 'Welcome to ChoreMaxx',
        body: `Hi ${name}, thanks for creating your household. Verify your email to activate your account.`,
        ctaLabel: 'Verify Email',
        confirmUrl: input.confirmUrl,
        footnote: 'Link expires in 24 hours.',
      };
  }
}

function rowsHtml(rows?: { label: string; value: string }[]): string {
  if (!rows?.length) return '';
  const items = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};">${escapeHtml(r.label)}</td>
          <td style="padding:8px 0;font-size:14px;color:${COLORS.darkText};text-align:right;font-weight:600;">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" style="margin:0 0 24px;border-collapse:collapse;">${items}</table>`;
}

export function renderBrandedAuthEmail(input: {
  action: AuthEmailAction;
  name: string;
  confirmUrl: string;
  otp?: string;
  oldEmail?: string;
  newEmail?: string;
}): { subject: string; html: string; text: string } {
  const c = contentFor(input);
  const otp = input.otp?.trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(c.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.body};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:${COLORS.card};border-radius:24px;padding:32px 32px 28px;">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <img src="${LOGO_URL}" width="56" height="56" alt="ChoreMaxx" style="display:block;border-radius:14px;margin:0 auto 8px;" />
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
                <span style="color:${COLORS.darkText};">chore</span><span style="color:${COLORS.coral};">maxx</span>
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:${COLORS.muted};">AI Household Operating System</p>
            </td>
          </tr>
          <tr>
            <td>
              <h1 style="margin:8px 0 16px;font-size:28px;line-height:1.2;font-weight:650;color:${COLORS.darkText};">${escapeHtml(c.headline)}</h1>
              <p style="margin:0 0 24px;font-size:17px;line-height:1.55;color:${COLORS.body};">${escapeHtml(c.body)}</p>
              ${rowsHtml(c.rows)}
              <a href="${escapeHtml(c.confirmUrl)}" style="display:inline-block;padding:16px 22px;background:${COLORS.coral};color:#FFFFFF;text-decoration:none;border-radius:16px;font-size:17px;font-weight:650;">${escapeHtml(c.ctaLabel)}</a>
              ${
                otp
                  ? `<p style="margin:28px 0 0;font-size:14px;color:${COLORS.muted};">Or enter this code:</p>
              <p style="margin:8px 0 0;font-size:28px;letter-spacing:0.16em;font-weight:700;color:${COLORS.darkText};">${escapeHtml(otp)}</p>`
                  : ''
              }
              ${
                c.footnote
                  ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.45;color:${COLORS.muted};">${escapeHtml(c.footnote)}</p>`
                  : ''
              }
              <p style="margin:28px 0 0;font-size:12px;line-height:1.45;color:${COLORS.muted};">If the button does not work, open this link:<br />
                <span style="word-break:break-all;color:${COLORS.body};">${escapeHtml(c.confirmUrl)}</span>
              </p>
              <hr style="border:none;border-top:1px solid ${COLORS.divider};margin:28px 0 16px;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center;">
                <a href="mailto:${SUPPORT}" style="color:${COLORS.muted};">${SUPPORT}</a>
                · <a href="${PRIVACY}" style="color:${COLORS.muted};">Privacy</a>
                · <a href="${TERMS}" style="color:${COLORS.muted};">Terms</a><br />
                © ${new Date().getFullYear()} ChoreMaxx. Made for happier homes.
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
    `ChoreMaxx — ${c.headline}`,
    '',
    c.body,
    ...(c.rows ?? []).flatMap((r) => [`${r.label}: ${r.value}`]),
    '',
    `${c.ctaLabel}: ${c.confirmUrl}`,
    otp ? `Code: ${otp}` : '',
    c.footnote ?? '',
    '',
    `Support: ${SUPPORT}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: c.subject, html, text };
}
