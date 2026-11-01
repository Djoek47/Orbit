/**
 * Auto-reply when a user sends Support feedback.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type SupportReceivedEmailProps = {
  name: string;
  ticketRef: string;
  errorCount: number;
  screenshotCount: number;
  supportUrl: string;
};

export default function SupportReceivedEmail({
  name,
  ticketRef,
  errorCount,
  screenshotCount,
  supportUrl,
}: SupportReceivedEmailProps) {
  return (
    <EmailLayout previewText="We got your note — the Choremaxx team will take a look.">
      <Heading
        style={{
          fontFamily: emailFontStack,
          ...emailType.heading,
          color: emailColors.darkText,
          margin: '8px 0 16px',
        }}>
        We got your note
      </Heading>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.body,
          color: emailColors.body,
          margin: '0 0 24px',
        }}>
        Hi {firstName(name)}, thanks for writing in. Your message is with the Choremaxx support team.
        Reply to this email if you have more to add.
      </Text>
      <InfoCard
        rows={[
          { label: 'Reference', value: ticketRef },
          { label: 'Errors attached', value: String(errorCount) },
          ...(screenshotCount > 0
            ? [{ label: 'Screenshots', value: String(screenshotCount) }]
            : []),
        ]}
      />
      <PrimaryButton href={supportUrl}>Open Support</PrimaryButton>
    </EmailLayout>
  );
}

SupportReceivedEmail.PreviewProps = {
  name: 'Alex',
  ticketRef: 'CMX-SUP-1A2B3C',
  errorCount: 2,
  screenshotCount: 1,
  supportUrl: 'https://www.choremaxx.app',
} satisfies SupportReceivedEmailProps;

export const subjectFor = ({ ticketRef }: SupportReceivedEmailProps) =>
  `We got your note · ${ticketRef}`;

export const textFor = ({
  name,
  ticketRef,
  errorCount,
  screenshotCount,
  supportUrl,
}: SupportReceivedEmailProps) =>
  [
    `Hi ${firstName(name)}, thanks for writing in. Your message is with the Choremaxx support team.`,
    '',
    `Reference: ${ticketRef}`,
    `Errors attached: ${errorCount}`,
    screenshotCount > 0 ? `Screenshots: ${screenshotCount}` : '',
    '',
    `Open Support: ${supportUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

export const _module: EmailModule<SupportReceivedEmailProps> = {
  default: SupportReceivedEmail,
  subjectFor,
  textFor,
};
