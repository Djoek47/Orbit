/**
 * Accelerated permanent deletion — confirmation email (up to 24h before purge).
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { SecondaryButton } from './components/SecondaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type HouseholdDeletionFinalEmailProps = {
  name: string;
  householdName: string;
  confirmBy: string;
  confirmUrl: string;
  cancelUrl: string;
};

export default function HouseholdDeletionFinalEmail({
  name,
  householdName,
  confirmBy,
  confirmUrl,
  cancelUrl,
}: HouseholdDeletionFinalEmailProps) {
  return (
    <EmailLayout previewText={`Confirm permanent deletion of ${householdName}`}>
      <Heading
        style={{
          fontFamily: emailFontStack,
          ...emailType.heading,
          color: emailColors.darkText,
          margin: '8px 0 16px',
        }}>
        Confirm permanent deletion
      </Heading>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.body,
          color: emailColors.body,
          margin: '0 0 24px',
        }}>
        Hi {firstName(name)}, you asked to delete {householdName} immediately. Tap Confirm within{' '}
        {confirmBy} to finish — or cancel to keep recovering.
      </Text>
      <AlertBox variant="danger">
        After confirmation this household cannot be recovered. Tasks, groceries, rewards, and member
        access are removed for everyone.
      </AlertBox>
      <InfoCard
        rows={[
          { label: 'Household', value: householdName },
          { label: 'Confirm by', value: confirmBy },
        ]}
      />
      <PrimaryButton href={confirmUrl}>Confirm permanent delete</PrimaryButton>
      <SecondaryButton href={cancelUrl}>Keep household</SecondaryButton>
    </EmailLayout>
  );
}

HouseholdDeletionFinalEmail.PreviewProps = {
  name: 'Alex',
  householdName: 'The Nero Home',
  confirmBy: '24 hours',
  confirmUrl: 'https://www.choremaxx.app',
  cancelUrl: 'https://www.choremaxx.app',
} satisfies HouseholdDeletionFinalEmailProps;

export const subjectFor = ({ householdName }: HouseholdDeletionFinalEmailProps) =>
  `Confirm permanent deletion · ${householdName}`;

export const textFor = ({
  name,
  householdName,
  confirmBy,
  confirmUrl,
  cancelUrl,
}: HouseholdDeletionFinalEmailProps) =>
  [
    `Hi ${firstName(name)}, you asked to delete ${householdName} immediately.`,
    `Tap Confirm within ${confirmBy} to finish — or cancel to keep recovering.`,
    '',
    `Confirm: ${confirmUrl}`,
    `Keep household: ${cancelUrl}`,
  ].join('\n');

export const _module: EmailModule<HouseholdDeletionFinalEmailProps> = {
  default: HouseholdDeletionFinalEmail,
  subjectFor,
  textFor,
};
