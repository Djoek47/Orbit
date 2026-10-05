/**
 * Subscription / trial started — congratulations + plan details.
 * Wired via supabase/functions/send-subscription-receipt (mock + StoreKit).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
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
  /** True when the 7-day free trial just started. */
  inTrial?: boolean;
  /** Expo Go / test path — no Apple charge yet. */
  mock?: boolean;
};

export default function SubscriptionStartedEmail({
  name,
  plan,
  price,
  renewalDate,
  manageUrl,
  inTrial,
  mock,
}: SubscriptionStartedEmailProps) {
  return (
    <EmailLayout
      previewText={
        inTrial
          ? `Your ${plan} free trial is active.`
          : `Your ${plan} plan is active.`
      }>
      <Heading
        style={{
          fontFamily: emailFontStack,
          ...emailType.heading,
          color: emailColors.darkText,
          margin: '8px 0 16px',
        }}>
        {inTrial ? 'Congratulations — trial started' : 'Your subscription is active'}
      </Heading>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.body,
          color: emailColors.body,
          margin: '0 0 24px',
        }}>
        Hi {firstName(name)},{' '}
        {inTrial
          ? `your 7-day free trial of ${plan} is underway. Enjoy full Poppins actions for your household.`
          : `thanks for subscribing to Choremaxx — ${plan} is active for your household.`}
      </Text>
      <InfoCard
        rows={[
          { label: 'Plan', value: plan },
          { label: 'Price', value: price },
          { label: inTrial ? 'Trial ends' : 'Renews', value: renewalDate },
          ...(mock ? [{ label: 'Note', value: 'Test purchase — no charge' }] : []),
        ]}
      />
      {inTrial ? (
        <AlertBox variant="info">
          You can cancel anytime in Apple Settings → Subscriptions before the trial ends.
        </AlertBox>
      ) : null}
      <PrimaryButton href={manageUrl}>Manage subscription</PrimaryButton>
    </EmailLayout>
  );
}

SubscriptionStartedEmail.PreviewProps = {
  name: 'Sarah',
  plan: 'Choremaxx Premium Yearly',
  price: '$49.99/year',
  renewalDate: 'October 12, 2026',
  manageUrl: 'https://www.choremaxx.app',
  inTrial: true,
  mock: true,
} satisfies SubscriptionStartedEmailProps;

export const subjectFor = ({ plan, inTrial }: SubscriptionStartedEmailProps) =>
  inTrial ? `Your ${plan} free trial started` : `Your ${plan} subscription is active`;

export const textFor = ({
  name,
  plan,
  price,
  renewalDate,
  manageUrl,
  inTrial,
  mock,
}: SubscriptionStartedEmailProps) =>
  [
    inTrial
      ? `Hi ${firstName(name)}, congratulations — your 7-day free trial of ${plan} is underway.`
      : `Hi ${firstName(name)}, thanks for subscribing to Choremaxx — ${plan} is active.`,
    '',
    `Plan: ${plan}`,
    `Price: ${price}`,
    `${inTrial ? 'Trial ends' : 'Renews'}: ${renewalDate}`,
    mock ? 'Note: Test purchase — no charge.' : '',
    '',
    `Manage subscription: ${manageUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

export const _module: EmailModule<SubscriptionStartedEmailProps> = {
  default: SubscriptionStartedEmail,
  subjectFor,
  textFor,
};
