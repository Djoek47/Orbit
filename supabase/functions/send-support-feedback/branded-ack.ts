/**
 * User auto-reply HTML for Support feedback (edge-deployable).
 */

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

const LOGO_URL =
  'https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-logo-mark.png';

const FONT_STACK =
  "'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

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

export function renderSupportAckEmail(input: {
  name: string;
  ticketRef: string;
  errorCount: number;
  screenshotCount: number;
}): { subject: string; html: string; text: string } {
  const name = firstName(input.name);
  const subject = `We got your note · ${input.ticketRef}`;
  const text = [
    `Hi ${name}, thanks for writing in. Your message is with the Choremaxx support team.`,
    '',
    `Reference: ${input.ticketRef}`,
    `Errors attached: ${input.errorCount}`,
    input.screenshotCount > 0 ? `Screenshots: ${input.screenshotCount}` : '',
    '',
    'Reply to this email if you have more to add.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:${FONT_STACK};color:${COLORS.body};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${COLORS.card};border-radius:24px;overflow:hidden;">
          <tr><td style="background:${COLORS.coral};height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:32px;">
              <img src="${LOGO_URL}" width="56" height="56" alt="Choremaxx" style="display:block;border-radius:16px;margin:0 auto 12px;" />
              <p style="margin:0 0 20px;text-align:center;font-family:${FONT_STACK};font-size:24px;font-weight:800;">
                <span style="color:${COLORS.chore};">chore</span><span style="color:${COLORS.coral};">maxx</span>
              </p>
              <h1 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:26px;font-weight:700;color:${COLORS.darkText};">We got your note</h1>
              <p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${COLORS.body};">
                Hi ${escapeHtml(name)}, thanks for writing in. Your message is with the Choremaxx support team. Reply to this email if you have more to add.
              </p>
              <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid ${COLORS.divider};font-size:13px;color:${COLORS.muted};">Reference</td>
                  <td style="padding:10px 0;border-bottom:1px solid ${COLORS.divider};font-size:14px;font-weight:600;color:${COLORS.darkText};text-align:right;">${escapeHtml(input.ticketRef)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid ${COLORS.divider};font-size:13px;color:${COLORS.muted};">Errors attached</td>
                  <td style="padding:10px 0;border-bottom:1px solid ${COLORS.divider};font-size:14px;font-weight:600;color:${COLORS.darkText};text-align:right;">${input.errorCount}</td>
                </tr>
                ${
                  input.screenshotCount > 0
                    ? `<tr>
                  <td style="padding:10px 0;font-size:13px;color:${COLORS.muted};">Screenshots</td>
                  <td style="padding:10px 0;font-size:14px;font-weight:600;color:${COLORS.darkText};text-align:right;">${input.screenshotCount}</td>
                </tr>`
                    : ''
                }
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
