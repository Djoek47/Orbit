/**
 * Email Verification — wired today via Supabase Auth Send Email Hook
 * (`supabase/functions/send-auth-email`, action: `signup`).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type VerificationEmailProps = {
  name: string;
  confirmUrl: string;
  expiresInHours?: number;
};

export default function VerificationEmail({ name, confirmUrl, expiresInHours = 24 }: VerificationEmailProps) {
  return (
    <EmailLayout previewText="Verify your email to activate your ChoreMaxx household.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.title, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Welcome to ChoreMaxx
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)},
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Thanks for creating your household. Verify your email to activate your account.
      </Text>
      <PrimaryButton href={confirmUrl}>Verify Email</PrimaryButton>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.caption,
          color: emailColors.muted,
          textAlign: 'center',
          margin: '20px 0 0',
        }}>
        Link expires in {expiresInHours} hours.
      </Text>
    </EmailLayout>
  );
}

VerificationEmail.PreviewProps = {
  name: 'Sarah',
  confirmUrl: 'https://choremaxx.app/auth/verify?token=preview',
  expiresInHours: 24,
} satisfies VerificationEmailProps;

export const subjectFor = () => 'Verify your ChoreMaxx account';

export const textFor = ({ name, confirmUrl, expiresInHours = 24 }: VerificationEmailProps) =>
  [
    `Welcome to ChoreMaxx, ${firstName(name)}!`,
    '',
    'Thanks for creating your household. Verify your email to activate your account.',
    '',
    `Verify Email: ${confirmUrl}`,
    '',
    `Link expires in ${expiresInHours} hours.`,
  ].join('\n');

export const _module: EmailModule<VerificationEmailProps> = {
  default: VerificationEmail,
  subjectFor,
  textFor,
};
