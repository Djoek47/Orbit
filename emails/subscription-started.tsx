/**
 * Subscription Started — template only. ChoreMaxx has no billing/Stripe
 * integration today; there is nothing to wire this to yet. Build the
 * payment provider first, then send this on `checkout.session.completed`
 * (or equivalent) with the real plan/price/renewal date.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type SubscriptionStartedEmailProps = {
  name: string;
  plan: string;
  price: string;
  renewalDate: string;
  manageUrl: string;
};

export default function SubscriptionStartedEmail({
  name,
  plan,
  price,
  renewalDate,
  manageUrl,
}: SubscriptionStartedEmailProps) {
  return (
    <EmailLayout previewText={`Your ${plan} plan is active.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Your subscription is active
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Hi {firstName(name)}, thanks for subscribing to ChoreMaxx.
      </Text>
      <InfoCard
        rows={[
          { label: 'Plan', value: plan },
          { label: 'Price', value: price },
          { label: 'Renews', value: renewalDate },
        ]}
      />
      <PrimaryButton href={manageUrl}>Manage Subscription</PrimaryButton>
    </EmailLayout>
  );
}

SubscriptionStartedEmail.PreviewProps = {
  name: 'Sarah',
  plan: 'ChoreMaxx Plus',
  price: '$6.99/month',
  renewalDate: 'September 4, 2026',
  manageUrl: 'https://choremaxx.app/account/billing',
} satisfies SubscriptionStartedEmailProps;

export const subjectFor = ({ plan }: SubscriptionStartedEmailProps) => `Your ${plan} subscription is active`;

export const textFor = ({ name, plan, price, renewalDate, manageUrl }: SubscriptionStartedEmailProps) =>
  [
    `Hi ${firstName(name)}, thanks for subscribing to ChoreMaxx.`,
    '',
    `Plan: ${plan}`,
    `Price: ${price}`,
    `Renews: ${renewalDate}`,
    '',
    `Manage Subscription: ${manageUrl}`,
  ].join('\n');

export const _module: EmailModule<SubscriptionStartedEmailProps> = {
  default: SubscriptionStartedEmail,
  subjectFor,
  textFor,
};
