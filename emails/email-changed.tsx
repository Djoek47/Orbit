/**
 * Email Changed — wired today via Supabase Auth Send Email Hook
 * (`supabase/functions/send-auth-email`, action: `email_change`).
 *
 * When `confirmUrl` is present (Auth confirmation), show a CTA.
 * When absent, this is a post-change notice only.
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

export type EmailChangedEmailProps = {
  name: string;
  oldEmail: string;
  newEmail: string;
  /** Auth hook confirmation link (optional for post-change notices). */
  confirmUrl?: string;
};

export default function EmailChangedEmail({
  name,
  oldEmail,
  newEmail,
  confirmUrl,
}: EmailChangedEmailProps) {
  return (
    <EmailLayout previewText="Your ChoreMaxx account email address changed.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        {confirmUrl ? 'Confirm your new email' : 'Your email address changed'}
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Hi {firstName(name)},{' '}
        {confirmUrl
          ? 'confirm this address to finish updating your ChoreMaxx account email.'
          : 'your ChoreMaxx account email was just updated.'}
      </Text>
      <InfoCard
        rows={[
          { label: 'Previous email', value: oldEmail },
          { label: 'New email', value: newEmail },
        ]}
      />
      {confirmUrl ? (
        <PrimaryButton href={confirmUrl}>Confirm new email</PrimaryButton>
      ) : (
        <AlertBox variant="warning">
          If you didn&apos;t make this change, contact support immediately at {EMAIL_LINKS.support}.
        </AlertBox>
      )}
      {confirmUrl ? (
        <AlertBox variant="warning">
          If you didn&apos;t request this, you can ignore this email or contact {EMAIL_LINKS.support}.
        </AlertBox>
      ) : null}
    </EmailLayout>
  );
}

EmailChangedEmail.PreviewProps = {
  name: 'Sarah',
  oldEmail: 'sarah@example.com',
  newEmail: 'sarah.nguyen@example.com',
  confirmUrl: 'https://choremaxx.app/auth/verify?type=email_change&token=preview',
} satisfies EmailChangedEmailProps;

export const subjectFor = ({ confirmUrl }: EmailChangedEmailProps) =>
  confirmUrl ? 'Confirm your new ChoreMaxx email' : 'Your ChoreMaxx email address changed';

export const textFor = ({ name, oldEmail, newEmail, confirmUrl }: EmailChangedEmailProps) =>
  [
    `Hi ${firstName(name)},`,
    '',
    confirmUrl
      ? 'Confirm this address to finish updating your ChoreMaxx account email.'
      : 'Your ChoreMaxx account email was just updated.',
    '',
    `Previous email: ${oldEmail}`,
    `New email: ${newEmail}`,
    '',
    confirmUrl ? `Confirm new email: ${confirmUrl}` : '',
    `If you didn't make this change, contact support immediately at ${EMAIL_LINKS.support}.`,
  ]
    .filter(Boolean)
    .join('\n');

export const _module: EmailModule<EmailChangedEmailProps> = {
  default: EmailChangedEmail,
  subjectFor,
  textFor,
};
