/**
 * Household deletion cancelled — recovery confirmed.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { AlertBox } from './components/AlertBox';
import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type HouseholdDeletionCancelledEmailProps = {
  name: string;
  householdName: string;
  homeUrl: string;
};

export default function HouseholdDeletionCancelledEmail({
  name,
  householdName,
  homeUrl,
}: HouseholdDeletionCancelledEmailProps) {
  return (
    <EmailLayout previewText={`${householdName} is safe — deletion cancelled`}>
      <Heading
        style={{
          fontFamily: emailFontStack,
          ...emailType.heading,
          color: emailColors.darkText,
          margin: '8px 0 16px',
        }}>
        Deletion cancelled
      </Heading>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.body,
          color: emailColors.body,
          margin: '0 0 24px',
        }}>
        Hi {firstName(name)}, good news — {householdName} stays. The scheduled permanent deletion is
        off.
      </Text>
      <AlertBox variant="success">Your tasks, groceries, rewards, and members are unchanged.</AlertBox>
      <InfoCard rows={[{ label: 'Household', value: householdName }]} />
      <PrimaryButton href={homeUrl}>Open household</PrimaryButton>
    </EmailLayout>
  );
}

HouseholdDeletionCancelledEmail.PreviewProps = {
  name: 'Alex',
  householdName: 'The Nero Home',
  homeUrl: 'https://www.choremaxx.app',
} satisfies HouseholdDeletionCancelledEmailProps;

export const subjectFor = ({ householdName }: HouseholdDeletionCancelledEmailProps) =>
  `Deletion cancelled · ${householdName}`;

export const textFor = ({
  name,
  householdName,
  homeUrl,
}: HouseholdDeletionCancelledEmailProps) =>
  [
    `Hi ${firstName(name)}, good news — ${householdName} stays. The scheduled permanent deletion is off.`,
    '',
    `Open household: ${homeUrl}`,
  ].join('\n');

export const _module: EmailModule<HouseholdDeletionCancelledEmailProps> = {
  default: HouseholdDeletionCancelledEmail,
  subjectFor,
  textFor,
};
