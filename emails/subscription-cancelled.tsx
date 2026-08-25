/**
 * Subscription Cancelled — template only. No billing/Stripe integration
 * exists; wire this on `customer.subscription.deleted` (or equivalent).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InfoCard } from './components/InfoCard';
import { SecondaryButton } from './components/SecondaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type SubscriptionCancelledEmailProps = {
  name: string;
  plan: string;
  accessUntil: string;
  reactivateUrl: string;
};

export default function SubscriptionCancelledEmail({
  name,
  plan,
  accessUntil,
  reactivateUrl,
}: SubscriptionCancelledEmailProps) {
  return (
    <EmailLayout previewText={`Your ${plan} subscription has been cancelled.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Your subscription is cancelled
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Hi {firstName(name)}, we&apos;ve cancelled your {plan} subscription as requested.
      </Text>
      <InfoCard rows={[{ label: 'Access until', value: accessUntil }]} />
      <SecondaryButton href={reactivateUrl}>Reactivate</SecondaryButton>
    </EmailLayout>
  );
}

SubscriptionCancelledEmail.PreviewProps = {
  name: 'Sarah',
  plan: 'ChoreMaxx Plus',
  accessUntil: 'September 4, 2026',
  reactivateUrl: 'https://choremaxx.app/account/billing/reactivate',
} satisfies SubscriptionCancelledEmailProps;

export const subjectFor = ({ plan }: SubscriptionCancelledEmailProps) => `Your ${plan} subscription is cancelled`;

export const textFor = ({ name, plan, accessUntil, reactivateUrl }: SubscriptionCancelledEmailProps) =>
  [
    `Hi ${firstName(name)}, we've cancelled your ${plan} subscription as requested.`,
    '',
    `Access until: ${accessUntil}`,
    '',
    `Reactivate: ${reactivateUrl}`,
  ].join('\n');

export const _module: EmailModule<SubscriptionCancelledEmailProps> = {
  default: SubscriptionCancelledEmail,
  subjectFor,
  textFor,
};
