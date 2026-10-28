/**
 * Branded Auth email HTML for Edge deploy.
 * Kept inside this function folder so `supabase functions deploy` bundles it
 * (imports from repo-root `emails/` are not uploaded by the remote bundler).
 *
 * Visuals: official coral house mark + Bricolage (same as confirm-email screen).
 * Mirror of tokens in `emails/theme.ts`.
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
  chore: '#C4922A',
  darkText: '#0F0E17',
  body: '#3D3A4E',
  muted: '#8B8AA0',
  bg: '#F7F4F2',
  card: '#FFFFFF',
  divider: '#ECE6E2',
};

/** Cream-plated house mark — same asset as app / website emails folder. */
const LOGO_URL =
  'https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-logo-mark.png';

const FONT_IMPORT =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap';

const FONT_STACK =
  "'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

const SUPPORT = 'support@choremaxx.app';
const PRIVACY = 'https://www.choremaxx.app/privacy';
const TERMS = 'https://www.choremaxx.app/terms';
/** Live footer — not a fake street. */
const POSTAL = 'Choremaxx · privacy@choremaxx.app';

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
        body: `Hi ${name}, we received a request to reset your Choremaxx password. Tap the button below to choose a new one.`,
        ctaLabel: 'Reset Password',
        confirmUrl: input.confirmUrl,
        footnote: 'Link expires in 60 minutes. If you did not request this, you can ignore this email.',
      };
    case 'magiclink':
    case 'email':
      return {
        subject: 'Your Choremaxx sign-in link',
        headline: 'Sign in to Choremaxx',
        body: `Hi ${name}, tap the button below to sign in. No password needed.`,
        ctaLabel: 'Sign In',
        confirmUrl: input.confirmUrl,
        footnote: 'Link expires in 15 minutes.',
      };
    case 'email_change':
      return {
        subject: 'Confirm your new Choremaxx email',
        headline: 'Confirm your new email',
        body: `Hi ${name}, confirm this address to finish updating your Choremaxx account email.`,
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
        subject: 'Confirm your email',
        headline: 'Confirm your email',
        body: `Hi ${name}, tap Confirm email on this phone — we’ll open Choremaxx and finish verifying your household account. Or enter the code below in the app.`,
        ctaLabel: 'Confirm email',
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
          <td style="padding:8px 0;font-size:13px;font-family:${FONT_STACK};color:${COLORS.muted};">${escapeHtml(r.label)}</td>
          <td style="padding:8px 0;font-size:14px;font-family:${FONT_STACK};color:${COLORS.darkText};text-align:right;font-weight:600;">${escapeHtml(r.value)}</td>
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
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(c.headline)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT_IMPORT}" rel="stylesheet" />
  <style>
    .cm-band { background: ${COLORS.coral}; height: 8px; font-size: 0; line-height: 0; }
    .cm-eyebrow {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid ${COLORS.coral};
      color: ${COLORS.coral};
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .cm-cta {
      background: linear-gradient(180deg, #E4552B 0%, ${COLORS.coral} 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 700;
    }
    .cm-code {
      background: #ffffff;
      border: 1px solid ${COLORS.divider};
      border-radius: 16px;
      padding: 16px 20px;
    }
    .cm-cell { border-top: 1px solid ${COLORS.divider}; }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:${FONT_STACK};color:${COLORS.body};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${COLORS.card};border-radius:24px;overflow:hidden;">
          <tr>
            <td class="cm-band" style="background:${COLORS.coral};height:8px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <img src="${LOGO_URL}" width="64" height="64" alt="Choremaxx" style="display:block;border-radius:18px;margin:0 auto 12px;" />
                    <p style="margin:0;font-family:${FONT_STACK};font-size:28px;line-height:32px;font-weight:800;letter-spacing:-0.03em;">
                      <span style="color:${COLORS.chore};">chore</span><span style="color:${COLORS.coral};">maxx</span>
                    </p>
                    <p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:13px;font-weight:500;color:${COLORS.muted};letter-spacing:0.02em;">AI Household OS</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <span class="cm-eyebrow" style="display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid ${COLORS.coral};color:${COLORS.coral};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(c.ctaLabel)}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin:8px 0 16px;font-family:${FONT_STACK};font-size:28px;line-height:34px;font-weight:700;color:${COLORS.darkText};">${escapeHtml(c.headline)}</h1>
                    <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:16px;line-height:24px;font-weight:400;color:${COLORS.body};">${escapeHtml(c.body)}</p>
                    ${rowsHtml(c.rows)}
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px;" width="100%">
                      <tr>
                        <td align="center" class="cm-cta" style="border-radius:16px;background:linear-gradient(180deg,#E4552B 0%,${COLORS.coral} 100%);">
                          <a href="${escapeHtml(c.confirmUrl)}" class="cm-cta" style="display:inline-block;padding:16px 28px;background:linear-gradient(180deg,#E4552B 0%,${COLORS.coral} 100%);color:#FFFFFF;text-decoration:none;border-radius:16px;font-family:${FONT_STACK};font-size:16px;font-weight:700;">
                            <span style="color:#FFFFFF;">${escapeHtml(c.ctaLabel)}</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                    ${
                      otp
                        ? `<p style="margin:28px 0 12px;font-family:${FONT_STACK};font-size:14px;color:${COLORS.muted};">Or enter this code in Choremaxx:</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="cm-code" align="center" style="background:#FFFFFF;border:1px solid ${COLORS.divider};border-radius:16px;padding:16px 20px;">
                          <p style="margin:0;font-family:${FONT_STACK};font-size:28px;letter-spacing:0.16em;font-weight:700;color:${COLORS.darkText};">${escapeHtml(otp)}</p>
                        </td>
                      </tr>
                    </table>`
                        : ''
                    }
                    ${
                      c.footnote
                        ? `<p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.45;color:${COLORS.muted};">${escapeHtml(c.footnote)}</p>`
                        : ''
                    }
                    <p style="margin:28px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.45;color:${COLORS.muted};">If the button does not work, open this link:<br />
                      <a href="${escapeHtml(c.confirmUrl)}" style="word-break:break-all;color:${COLORS.coral};text-decoration:underline;">${escapeHtml(c.confirmUrl)}</a>
                    </p>
                  </td>
                </tr>
                <tr class="cm-cell">
                  <td class="cm-cell" style="border-top:1px solid ${COLORS.divider};padding-top:16px;margin-top:28px;">
                    <p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center;">
                      <a href="mailto:${SUPPORT}" style="color:${COLORS.muted};">${SUPPORT}</a>
                      · <a href="${PRIVACY}" style="color:${COLORS.muted};">Privacy</a>
                      · <a href="${TERMS}" style="color:${COLORS.muted};">Terms</a><br />
                      ${POSTAL}<br />
                      © ${new Date().getFullYear()} ChoreMaxx. Made for happier homes.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `choremaxx — ${c.headline}`,
    '',
    c.body,
    ...(c.rows ?? []).flatMap((r) => [`${r.label}: ${r.value}`]),
    '',
    `${c.ctaLabel}: ${c.confirmUrl}`,
    otp ? `Code: ${otp}` : '',
    c.footnote ?? '',
    '',
    `Support: ${SUPPORT}`,
    POSTAL,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: c.subject, html, text };
}
