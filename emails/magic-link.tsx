/**
 * Magic Login Link — wired today via Supabase Auth Send Email Hook
 * (`supabase/functions/send-auth-email`, action: `magiclink` / `email`).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type MagicLinkEmailProps = {
  name: string;
  signInUrl: string;
  expiresInMinutes?: number;
};

export default function MagicLinkEmail({ name, signInUrl, expiresInMinutes = 15 }: MagicLinkEmailProps) {
  return (
    <EmailLayout previewText="Your ChoreMaxx sign-in link is ready.">
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Sign in to ChoreMaxx
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)},
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Tap the button below to sign in. No password needed.
      </Text>
      <PrimaryButton href={signInUrl}>Sign In</PrimaryButton>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.caption,
          color: emailColors.muted,
          textAlign: 'center',
          margin: '20px 0 0',
        }}>
        Link expires in {expiresInMinutes} minutes.
      </Text>
    </EmailLayout>
  );
}

MagicLinkEmail.PreviewProps = {
  name: 'Sarah',
  signInUrl: 'https://choremaxx.app/auth/verify?type=magiclink&token=preview',
  expiresInMinutes: 15,
} satisfies MagicLinkEmailProps;

export const subjectFor = () => 'Your ChoreMaxx sign-in link';

export const textFor = ({ name, signInUrl, expiresInMinutes = 15 }: MagicLinkEmailProps) =>
  [
    `Hi ${firstName(name)},`,
    '',
    'Tap the link below to sign in. No password needed.',
    '',
    `Sign In: ${signInUrl}`,
    '',
    `Link expires in ${expiresInMinutes} minutes.`,
  ].join('\n');

export const _module: EmailModule<MagicLinkEmailProps> = {
  default: MagicLinkEmail,
  subjectFor,
  textFor,
};
