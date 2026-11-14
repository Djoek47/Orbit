/**
 * Security Alert — no login-anomaly detection exists today. Wire once a
 * new-device / new-location sign-in check is added (e.g. a Database Webhook
 * on `auth.sessions` insert compared against the user's known devices).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType, EMAIL_LINKS } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type SecurityAlertEmailProps = {
  name: string;
  device: string;
  browser: string;
  location: string;
  time: string;
  reviewUrl: string;
};

export default function SecurityAlertEmail({
  name,
  device,
  browser,
  location,
  time,
  reviewUrl,
}: SecurityAlertEmailProps) {
  return (
    <EmailLayout previewText="New sign-in to your ChoreMaxx account.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        New sign-in detected
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Hi {firstName(name)}, we noticed a new sign-in to your ChoreMaxx account.
      </Text>
      <InfoCard
        rows={[
          { label: 'Device', value: device },
          { label: 'Browser', value: browser },
          { label: 'Approximate location', value: location },
          { label: 'Time', value: time },
        ]}
      />
      <PrimaryButton href={reviewUrl}>Review Activity</PrimaryButton>
      <AlertBox variant="danger">
        If this wasn&apos;t you, secure your account and contact {EMAIL_LINKS.support} right away.
      </AlertBox>
    </EmailLayout>
  );
}

SecurityAlertEmail.PreviewProps = {
  name: 'Sarah',
  device: 'iPhone 16 Pro',
  browser: 'ChoreMaxx App',
  location: 'Austin, TX',
  time: 'Today, 9:42 PM CDT',
  reviewUrl: 'https://choremaxx.app/account/security',
} satisfies SecurityAlertEmailProps;

export const subjectFor = () => 'New sign-in to your ChoreMaxx account';

export const textFor = ({ name, device, browser, location, time, reviewUrl }: SecurityAlertEmailProps) =>
  [
    `Hi ${firstName(name)}, we noticed a new sign-in to your ChoreMaxx account.`,
    '',
    `Device: ${device}`,
    `Browser: ${browser}`,
    `Approximate location: ${location}`,
    `Time: ${time}`,
    '',
    `Review Activity: ${reviewUrl}`,
    '',
    `If this wasn't you, secure your account and contact ${EMAIL_LINKS.support} right away.`,
  ].join('\n');

export const _module: EmailModule<SecurityAlertEmailProps> = {
  default: SecurityAlertEmail,
  subjectFor,
  textFor,
};
