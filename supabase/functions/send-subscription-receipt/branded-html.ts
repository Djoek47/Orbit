/**
 * Subscription / trial started HTML (mirrors emails/subscription-started.tsx).
 */
import {
  alertBoxHtml,
  escapeHtml,
  firstName,
  infoRowsHtml,
  primaryButtonHtml,
  wrapEmailCard,
} from '../_shared/email-brand.ts';

export type SubscriptionReceiptHtmlInput = {
  name: string;
  plan: string;
  price: string;
  renewalDate: string;
  manageUrl?: string;
  inTrial: boolean;
  mock: boolean;
};

export function renderSubscriptionReceiptEmail(input: SubscriptionReceiptHtmlInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = firstName(input.name);
  const manageUrl = input.manageUrl?.trim() || 'https://www.choremaxx.app';
  const subject = input.inTrial
    ? `Your ${input.plan} free trial started`
    : `Your ${input.plan} subscription is active`;
  const heading = input.inTrial
    ? 'Congratulations — trial started'
    : 'Your subscription is active';
  const intro = input.inTrial
    ? `your 7-day free trial of ${input.plan} is underway. Enjoy full Poppins actions for your household.`
    : `thanks for subscribing to Choremaxx — ${input.plan} is active for your household.`;

  const rows = [
    { label: 'Plan', value: input.plan },
    { label: 'Price', value: input.price },
    { label: input.inTrial ? 'Trial ends' : 'Renews', value: input.renewalDate },
    ...(input.mock ? [{ label: 'Note', value: 'Test purchase — no charge' }] : []),
  ];

  const text = [
    input.inTrial
      ? `Hi ${name}, congratulations — your 7-day free trial of ${input.plan} is underway.`
      : `Hi ${name}, thanks for subscribing to Choremaxx — ${input.plan} is active.`,
    '',
    `Plan: ${input.plan}`,
    `Price: ${input.price}`,
    `${input.inTrial ? 'Trial ends' : 'Renews'}: ${input.renewalDate}`,
    input.mock ? 'Note: Test purchase — no charge.' : '',
    '',
    `Manage subscription: ${manageUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = [
    `<table role="presentation" width="100%" style="margin:0 0 28px;border-collapse:collapse;">${infoRowsHtml(rows)}</table>`,
    input.inTrial
      ? alertBoxHtml(
          'info',
          'You can cancel anytime in Apple Settings → Subscriptions before the trial ends.'
        )
      : '',
    primaryButtonHtml(manageUrl, 'Manage subscription'),
  ].join('');

  const html = wrapEmailCard({
    subject,
    badge: input.inTrial ? 'Trial' : 'Subscription',
    badgeColor: input.inTrial ? '#34C759' : undefined,
    heading,
    introHtml: `<p style="margin:0 0 24px;font-family:'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif;font-size:16px;line-height:24px;color:#3D3A4E;">Hi ${escapeHtml(name)}, ${escapeHtml(intro)}</p>`,
    bodyHtml,
  });

  return { subject, html, text };
}
