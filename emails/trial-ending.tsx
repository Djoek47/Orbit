/**
 * Trial Ending — template only. No billing/Stripe integration or trial
 * concept exists in the app today; wire this from a trial-expiry cron once
 * one does.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName, pluralize } from './utils/format';

export type TrialEndingEmailProps = {
  name: string;
  daysRemaining: number;
  plan: string;
  upgradeUrl: string;
};

export default function TrialEndingEmail({ name, daysRemaining, plan, upgradeUrl }: TrialEndingEmailProps) {
  return (
    <EmailLayout previewText={`Your ChoreMaxx trial ends in ${pluralize(daysRemaining, 'day')}.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Your trial is ending soon
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Hi {firstName(name)}, your ChoreMaxx trial ends in {pluralize(daysRemaining, 'day')}. Upgrade to{' '}
        {plan} to keep everything running without a gap.
      </Text>
      <AlertBox variant="info">
        Your household, tasks, and rewards stay exactly as they are — upgrading just keeps things active.
      </AlertBox>
      <PrimaryButton href={upgradeUrl}>Upgrade Now</PrimaryButton>
    </EmailLayout>
  );
}

TrialEndingEmail.PreviewProps = {
  name: 'Sarah',
  daysRemaining: 3,
  plan: 'ChoreMaxx Plus',
  upgradeUrl: 'https://choremaxx.app/account/billing/upgrade',
} satisfies TrialEndingEmailProps;

export const subjectFor = ({ daysRemaining }: TrialEndingEmailProps) =>
  `Your trial ends in ${pluralize(daysRemaining, 'day')}`;

export const textFor = ({ name, daysRemaining, plan, upgradeUrl }: TrialEndingEmailProps) =>
  [
    `Hi ${firstName(name)}, your ChoreMaxx trial ends in ${pluralize(daysRemaining, 'day')}.`,
    `Upgrade to ${plan} to keep everything running without a gap.`,
    '',
    `Upgrade Now: ${upgradeUrl}`,
  ].join('\n');

export const _module: EmailModule<TrialEndingEmailProps> = {
  default: TrialEndingEmail,
  subjectFor,
  textFor,
};
