/**
 * Email Changed — wired today via Supabase Auth Send Email Hook
 * (`supabase/functions/send-auth-email`, action: `email_change`).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
import { InfoCard } from './components/InfoCard';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType, EMAIL_LINKS } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type EmailChangedEmailProps = {
  name: string;
  oldEmail: string;
  newEmail: string;
};

export default function EmailChangedEmail({ name, oldEmail, newEmail }: EmailChangedEmailProps) {
  return (
    <EmailLayout previewText="Your ChoreMaxx account email address changed.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Your email address changed
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Hi {firstName(name)}, your ChoreMaxx account email was just updated.
      </Text>
      <InfoCard
        rows={[
          { label: 'Previous email', value: oldEmail },
          { label: 'New email', value: newEmail },
        ]}
      />
      <AlertBox variant="warning">
        If you didn&apos;t make this change, contact support immediately at {EMAIL_LINKS.support}.
      </AlertBox>
    </EmailLayout>
  );
}

EmailChangedEmail.PreviewProps = {
  name: 'Sarah',
  oldEmail: 'sarah@example.com',
  newEmail: 'sarah.nguyen@example.com',
} satisfies EmailChangedEmailProps;

export const subjectFor = () => 'Your ChoreMaxx email address changed';

export const textFor = ({ name, oldEmail, newEmail }: EmailChangedEmailProps) =>
  [
    `Hi ${firstName(name)},`,
    '',
    'Your ChoreMaxx account email was just updated.',
    '',
    `Previous email: ${oldEmail}`,
    `New email: ${newEmail}`,
    '',
    `If you didn't make this change, contact support immediately at ${EMAIL_LINKS.support}.`,
  ].join('\n');

export const _module: EmailModule<EmailChangedEmailProps> = {
  default: EmailChangedEmail,
  subjectFor,
  textFor,
};
