/**
 * Shared Choremaxx email chrome for Resend edge functions.
 * Keep HTML self-contained — React Email templates live in /emails for preview.
 */

export const EMAIL_COLORS = {
  coral: '#D85A30',
  chore: '#C4922A',
  darkText: '#0F0E17',
  body: '#3D3A4E',
  muted: '#8B8AA0',
  bg: '#F7F4F2',
  card: '#FFFFFF',
  divider: '#ECE6E2',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF453A',
  info: '#D85A30',
} as const;

export const EMAIL_LOGO_URL =
  'https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-logo-mark.png';

export const EMAIL_FONT_IMPORT =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap';

export const EMAIL_FONT_STACK =
  "'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name || 'there';
}

export function infoRowsHtml(
  rows: { label: string; value: string }[]
): string {
  return rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:10px 0;font-size:13px;font-family:${EMAIL_FONT_STACK};color:${EMAIL_COLORS.muted};border-bottom:1px solid ${EMAIL_COLORS.divider};">${escapeHtml(r.label)}</td>
          <td style="padding:10px 0;font-size:14px;font-family:${EMAIL_FONT_STACK};color:${EMAIL_COLORS.darkText};text-align:right;font-weight:600;border-bottom:1px solid ${EMAIL_COLORS.divider};">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join('');
}

export function alertBoxHtml(
  variant: 'info' | 'warning' | 'danger' | 'success',
  body: string
): string {
  const color =
    variant === 'success'
      ? EMAIL_COLORS.success
      : variant === 'warning'
        ? EMAIL_COLORS.warning
        : variant === 'danger'
          ? EMAIL_COLORS.danger
          : EMAIL_COLORS.info;
  const label =
    variant === 'success'
      ? 'Success'
      : variant === 'warning'
        ? 'Warning'
        : variant === 'danger'
          ? 'Security alert'
          : 'Note';
  return `<div style="border-left:3px solid ${color};background:${EMAIL_COLORS.bg};border-radius:12px;padding:16px 18px;margin:0 0 24px;">
    <p style="margin:0 0 4px;font-family:${EMAIL_FONT_STACK};font-size:13px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.04em;">${label}</p>
    <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:22px;color:${EMAIL_COLORS.body};">${escapeHtml(body)}</p>
  </div>`;
}

export function primaryButtonHtml(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:0 0 12px;">
    <tr>
      <td align="center" style="border-radius:16px;background:linear-gradient(180deg,#E4552B 0%,${EMAIL_COLORS.coral} 100%);">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;color:#FFFFFF;text-decoration:none;border-radius:16px;font-family:${EMAIL_FONT_STACK};font-size:16px;font-weight:700;">
          <span style="color:#FFFFFF;">${escapeHtml(label)}</span>
        </a>
      </td>
    </tr>
  </table>`;
}

export function secondaryButtonHtml(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:0 0 12px;">
    <tr>
      <td align="center" style="border-radius:16px;border:1.5px solid ${EMAIL_COLORS.divider};background:${EMAIL_COLORS.card};">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;color:${EMAIL_COLORS.darkText};text-decoration:none;border-radius:16px;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export function wrapEmailCard(opts: {
  subject: string;
  badge: string;
  badgeColor?: string;
  heading: string;
  introHtml: string;
  bodyHtml: string;
}): string {
  const badgeColor = opts.badgeColor ?? EMAIL_COLORS.coral;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.subject)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${EMAIL_FONT_IMPORT}" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.bg};font-family:${EMAIL_FONT_STACK};color:${EMAIL_COLORS.body};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.bg};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${EMAIL_COLORS.card};border-radius:24px;overflow:hidden;">
          <tr>
            <td style="background:${EMAIL_COLORS.coral};height:8px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <img src="${EMAIL_LOGO_URL}" width="64" height="64" alt="Choremaxx" style="display:block;border-radius:18px;margin:0 auto 12px;" />
                    <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:28px;line-height:32px;font-weight:800;letter-spacing:-0.03em;">
                      <span style="color:${EMAIL_COLORS.chore};">chore</span><span style="color:${EMAIL_COLORS.coral};">maxx</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${badgeColor}22;color:${badgeColor};font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(opts.badge)}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin:8px 0 16px;font-family:${EMAIL_FONT_STACK};font-size:28px;line-height:34px;font-weight:700;color:${EMAIL_COLORS.darkText};">${escapeHtml(opts.heading)}</h1>
                    ${opts.introHtml}
                    ${opts.bodyHtml}
                    <p style="margin:24px 0 0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:1.45;color:${EMAIL_COLORS.muted};">
                      Questions? Reply to this email or write support@choremaxx.app.
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
}
