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
  /** Numeric OTP from Auth hook — enter in-app when the link fails. */
  otp?: string;
  expiresInHours?: number;
};

export default function VerificationEmail({
  name,
  confirmUrl,
  otp,
  expiresInHours = 24,
}: VerificationEmailProps) {
  return (
    <EmailLayout previewText="Confirm your email to activate your Choremaxx household.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.title, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Confirm your email
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)},
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Tap Confirm email on this phone — we’ll open Choremaxx and finish verifying your household
        account. Or enter the code below in the app.
      </Text>
      <PrimaryButton href={confirmUrl}>Confirm email</PrimaryButton>
      {otp ? (
        <>
          <Text
            style={{
              fontFamily: emailFontStack,
              ...emailType.caption,
              color: emailColors.muted,
              margin: '28px 0 0',
            }}>
            Or enter this code in Choremaxx:
          </Text>
          <Text
            style={{
              fontFamily: emailFontStack,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: emailColors.darkText,
              margin: '8px 0 0',
            }}>
            {otp}
          </Text>
        </>
      ) : null}
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
  confirmUrl: 'https://www.choremaxx.app/auth/callback?token_hash=preview&type=signup',
  otp: '83538952',
  expiresInHours: 24,
} satisfies VerificationEmailProps;

export const subjectFor = () => 'Confirm your email';

export const textFor = ({ name, confirmUrl, otp, expiresInHours = 24 }: VerificationEmailProps) =>
  [
    `Confirm your email, ${firstName(name)}`,
    '',
    'Tap Confirm email on this phone — we’ll open Choremaxx and finish verifying your household account.',
    '',
    `Confirm email: ${confirmUrl}`,
    otp ? `Or enter this code in Choremaxx: ${otp}` : '',
    '',
    `Link expires in ${expiresInHours} hours.`,
  ]
    .filter(Boolean)
    .join('\n');

export const _module: EmailModule<VerificationEmailProps> = {
  default: VerificationEmail,
  subjectFor,
  textFor,
};
