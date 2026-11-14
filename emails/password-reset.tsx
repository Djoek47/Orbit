/**
 * Password Reset — wired today via Supabase Auth Send Email Hook
 * (`supabase/functions/send-auth-email`, action: `recovery`).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type PasswordResetEmailProps = {
  name: string;
  resetUrl: string;
  expiresInMinutes?: number;
};

export default function PasswordResetEmail({ name, resetUrl, expiresInMinutes = 60 }: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your ChoreMaxx password.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Reset your password
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)},
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        We received a request to reset your ChoreMaxx password. Tap the button below to choose a new one.
      </Text>
      <PrimaryButton href={resetUrl}>Reset Password</PrimaryButton>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.caption,
          color: emailColors.muted,
          textAlign: 'center',
          margin: '20px 0 0',
        }}>
        Link expires in {expiresInMinutes} minutes. If you didn&apos;t request this, you can ignore this
        email.
      </Text>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  name: 'Sarah',
  resetUrl: 'https://choremaxx.app/auth/reset?token=preview',
  expiresInMinutes: 60,
} satisfies PasswordResetEmailProps;

export const subjectFor = () => 'Reset your password';

export const textFor = ({ name, resetUrl, expiresInMinutes = 60 }: PasswordResetEmailProps) =>
  [
    `Hi ${firstName(name)},`,
    '',
    'We received a request to reset your ChoreMaxx password.',
    '',
    `Reset Password: ${resetUrl}`,
    '',
    `Link expires in ${expiresInMinutes} minutes. If you didn't request this, you can ignore this email.`,
  ].join('\n');

export const _module: EmailModule<PasswordResetEmailProps> = {
  default: PasswordResetEmail,
  subjectFor,
  textFor,
};
