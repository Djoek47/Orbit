/**
 * Credit / token pack purchase confirmation.
 * Wired via supabase/functions/send-credit-receipt (also for Expo Go mock buys).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type CreditPurchaseEmailProps = {
  name: string;
  tokens: number;
  price: string;
  orderId: string;
  householdName: string;
  /** True for Expo Go / test purchases — no card charged. */
  mock: boolean;
  creditsUrl: string;
};

export default function CreditPurchaseEmail({
  name,
  tokens,
  price,
  orderId,
  householdName,
  mock,
  creditsUrl,
}: CreditPurchaseEmailProps) {
  return (
    <EmailLayout
      previewText={`Congratulations — ${tokens} Poppins actions added to ${householdName}.`}>
      <Heading
        style={{
          fontFamily: emailFontStack,
          ...emailType.heading,
          color: emailColors.darkText,
          margin: '8px 0 16px',
        }}>
        Congratulations — credits added
      </Heading>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.body,
          color: emailColors.body,
          margin: '0 0 24px',
        }}>
        Hi {firstName(name)}, {tokens} Poppins actions are now in your credit bank for{' '}
        {householdName}. They never expire — your monthly allowance is spent first, then these.
      </Text>
      <InfoCard
        rows={[
          { label: 'Actions', value: String(tokens) },
          { label: 'Amount', value: price },
          { label: 'Order', value: orderId },
          ...(mock ? [{ label: 'Note', value: 'Test purchase — no charge' }] : []),
        ]}
      />
      <PrimaryButton href={creditsUrl}>View credits</PrimaryButton>
    </EmailLayout>
  );
}

CreditPurchaseEmail.PreviewProps = {
  name: 'Alex',
  tokens: 600,
  price: '$4.99',
  orderId: 'CMX-0001-0002-0003',
  householdName: 'The Rivera house',
  mock: true,
  creditsUrl: 'https://www.choremaxx.app',
} satisfies CreditPurchaseEmailProps;

export const subjectFor = ({ tokens }: CreditPurchaseEmailProps) =>
  `Your Choremaxx receipt — ${tokens} Poppins actions`;

export const textFor = ({
  name,
  tokens,
  price,
  orderId,
  householdName,
  mock,
  creditsUrl,
}: CreditPurchaseEmailProps) =>
  [
    `Hi ${firstName(name)}, congratulations — ${tokens} Poppins actions were added to ${householdName}.`,
    '',
    `Actions: ${tokens}`,
    `Amount: ${price}`,
    `Order: ${orderId}`,
    mock ? 'Note: Test purchase — no charge.' : '',
    '',
    'Credits never expire. Monthly allowance is spent first, then these.',
    '',
    `View credits: ${creditsUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

export const _module: EmailModule<CreditPurchaseEmailProps> = {
  default: CreditPurchaseEmail,
  subjectFor,
  textFor,
};
