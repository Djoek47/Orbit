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
    <EmailLayout previewText="Confirm your email to activate your Choremaxx household.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.title, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Confirm your email
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)},
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Open this link on your phone to verify your household account, then continue in Choremaxx —
        same step as the Confirm your email screen in the app.
      </Text>
      <PrimaryButton href={confirmUrl}>Confirm email</PrimaryButton>
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

export const subjectFor = () => 'Confirm your email';

export const textFor = ({ name, confirmUrl, expiresInHours = 24 }: VerificationEmailProps) =>
  [
    `Confirm your email, ${firstName(name)}`,
    '',
    'Open this link on your phone to verify your household account, then continue in Choremaxx.',
    '',
    `Confirm email: ${confirmUrl}`,
    '',
    `Link expires in ${expiresInHours} hours.`,
  ].join('\n');

export const _module: EmailModule<VerificationEmailProps> = {
  default: VerificationEmail,
  subjectFor,
  textFor,
};
