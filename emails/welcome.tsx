/**
 * Welcome — sent after email confirmation completes. No trigger exists yet;
 * wire from a Database Webhook on `auth.users` (fires when `confirmed_at`
 * transitions from null to a timestamp), or client-side right after
 * `hydrateFromSession` succeeds post-confirmation.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type WelcomeEmailProps = {
  name: string;
  householdName: string;
  openUrl: string;
};

export default function WelcomeEmail({ name, householdName, openUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText={`${householdName} is ready — open ChoreMaxx to get started.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.title, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Your household is ready
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)},
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        {householdName} is set up in ChoreMaxx. Assign chores, track XP, and let Nova keep things running
        smoothly — all in one calm, shared place.
      </Text>
      <PrimaryButton href={openUrl}>Open ChoreMaxx</PrimaryButton>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  name: 'Sarah',
  householdName: 'The Nguyen Home',
  openUrl: 'https://choremaxx.app/open',
} satisfies WelcomeEmailProps;

export const subjectFor = () => 'Welcome to ChoreMaxx';

export const textFor = ({ name, householdName, openUrl }: WelcomeEmailProps) =>
  [
    `Your household is ready, ${firstName(name)}!`,
    '',
    `${householdName} is set up in ChoreMaxx. Assign chores, track XP, and let Nova keep things running smoothly.`,
    '',
    `Open ChoreMaxx: ${openUrl}`,
  ].join('\n');

export const _module: EmailModule<WelcomeEmailProps> = {
  default: WelcomeEmail,
  subjectFor,
  textFor,
};
