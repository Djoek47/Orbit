/**
 * Payment Failed — template only. No billing/Stripe integration exists;
 * wire this on `invoice.payment_failed` (or equivalent) once one does.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type PaymentFailedEmailProps = {
  name: string;
  plan: string;
  amount: string;
  reason?: string;
  updateUrl: string;
};

export default function PaymentFailedEmail({ name, plan, amount, reason, updateUrl }: PaymentFailedEmailProps) {
  return (
    <EmailLayout previewText="We couldn't process your ChoreMaxx payment.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        We couldn&apos;t process your payment
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)}, your payment of {amount} for {plan} didn&apos;t go through.
      </Text>
      <AlertBox variant="warning">
        {reason ?? 'Your card issuer declined the charge.'} Update your payment method to keep ChoreMaxx
        running without interruption.
      </AlertBox>
      <PrimaryButton href={updateUrl}>Update Payment Method</PrimaryButton>
    </EmailLayout>
  );
}

PaymentFailedEmail.PreviewProps = {
  name: 'Sarah',
  plan: 'ChoreMaxx Plus',
  amount: '$6.99',
  reason: 'Your card was declined.',
  updateUrl: 'https://choremaxx.app/account/billing/payment-method',
} satisfies PaymentFailedEmailProps;

export const subjectFor = () => "We couldn't process your ChoreMaxx payment";

export const textFor = ({ name, plan, amount, reason, updateUrl }: PaymentFailedEmailProps) =>
  [
    `Hi ${firstName(name)}, your payment of ${amount} for ${plan} didn't go through.`,
    '',
    reason ?? 'Your card issuer declined the charge.',
    'Update your payment method to keep ChoreMaxx running without interruption.',
    '',
    `Update Payment Method: ${updateUrl}`,
  ].join('\n');

export const _module: EmailModule<PaymentFailedEmailProps> = {
  default: PaymentFailedEmail,
  subjectFor,
  textFor,
};
