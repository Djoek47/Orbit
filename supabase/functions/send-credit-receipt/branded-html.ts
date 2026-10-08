/**
 * Credit purchase receipt HTML for Edge deploy (mirrors emails/credit-purchase.tsx).
 * Kept inside this folder so supabase functions deploy bundles it.
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
  success: '#34C759',
};

const LOGO_URL =
  'https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-logo-mark.png';

const FONT_IMPORT =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap';

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

export type CreditReceiptHtmlInput = {
  name: string;
  tokens: number;
  price: string;
  orderId: string;
  householdName: string;
  mock: boolean;
  creditsUrl?: string;
};

export function renderCreditReceiptEmail(input: CreditReceiptHtmlInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = firstName(input.name);
  const household = input.householdName.trim() || 'your household';
  const creditsUrl = input.creditsUrl?.trim() || 'https://www.choremaxx.app';
  const subject = `Your Choremaxx receipt — ${input.tokens} Poppins actions`;

  const rows = [
    { label: 'Actions', value: String(input.tokens) },
    { label: 'Amount', value: input.price },
    { label: 'Order', value: input.orderId },
    ...(input.mock ? [{ label: 'Note', value: 'Test purchase — no charge' }] : []),
  ];
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:10px 0;font-size:13px;font-family:${FONT_STACK};color:${COLORS.muted};border-bottom:1px solid ${COLORS.divider};">${escapeHtml(r.label)}</td>
          <td style="padding:10px 0;font-size:14px;font-family:${FONT_STACK};color:${COLORS.darkText};text-align:right;font-weight:600;border-bottom:1px solid ${COLORS.divider};">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join('');

  const text = [
    `Hi ${name}, congratulations — ${input.tokens} Poppins actions were added to ${household}.`,
    '',
    `Actions: ${input.tokens}`,
    `Amount: ${input.price}`,
    `Order: ${input.orderId}`,
    input.mock ? 'Note: Test purchase — no charge.' : '',
    '',
    'Credits never expire. Monthly allowance is spent first, then these.',
    '',
    `View credits: ${creditsUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT_IMPORT}" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:${FONT_STACK};color:${COLORS.body};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${COLORS.card};border-radius:24px;overflow:hidden;">
          <tr>
            <td style="background:${COLORS.coral};height:8px;font-size:0;line-height:0;">&nbsp;</td>
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
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${COLORS.success}22;color:${COLORS.success};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Receipt</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin:8px 0 16px;font-family:${FONT_STACK};font-size:28px;line-height:34px;font-weight:700;color:${COLORS.darkText};">Congratulations — credits added</h1>
                    <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${COLORS.body};">
                      Hi ${escapeHtml(name)}, <strong>${input.tokens}</strong> Poppins actions are now in your credit bank for ${escapeHtml(household)}. They never expire — your monthly allowance is spent first, then these.
                    </p>
                    <table role="presentation" width="100%" style="margin:0 0 28px;border-collapse:collapse;">${rowsHtml}</table>
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td align="center" style="border-radius:16px;background:linear-gradient(180deg,#E4552B 0%,${COLORS.coral} 100%);">
                          <a href="${escapeHtml(creditsUrl)}" style="display:inline-block;padding:16px 28px;color:#FFFFFF;text-decoration:none;border-radius:16px;font-family:${FONT_STACK};font-size:16px;font-weight:700;">
                            <span style="color:#FFFFFF;">View credits</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.45;color:${COLORS.muted};">
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

  return { subject, html, text };
}
