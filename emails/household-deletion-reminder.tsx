/**
 * Household deletion reminder — stages: 7d / 3d / 24h / 1h11m before purge.
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

export type DeletionReminderStage = '7d' | '3d' | '24h' | '1h11m';

export type HouseholdDeletionReminderEmailProps = {
  name: string;
  householdName: string;
  stage: DeletionReminderStage;
  purgeDate: string;
  recoverUrl: string;
  optOutUrl: string;
};

const STAGE_COPY: Record<
  DeletionReminderStage,
  { headline: string; body: string; urgency: 'info' | 'warning' | 'danger' }
> = {
  '7d': {
    headline: '7 days left to recover your household',
    body: 'Your household is still scheduled for permanent deletion. Cancel anytime in the next week to keep everything.',
    urgency: 'info',
  },
  '3d': {
    headline: '3 days left — recover soon',
    body: 'In three days this household’s tasks, groceries, rewards, and member access will be permanently removed.',
    urgency: 'warning',
  },
  '24h': {
    headline: '24 hours left',
    body: 'Tomorrow this household will be permanently deleted. Open Choremaxx now if you want to cancel.',
    urgency: 'danger',
  },
  '1h11m': {
    headline: 'About 1 hour left',
    body: 'This is the last reminder. Permanent deletion is imminent — cancel now if this was a mistake.',
    urgency: 'danger',
  },
};

export default function HouseholdDeletionReminderEmail({
  name,
  householdName,
  stage,
  purgeDate,
  recoverUrl,
  optOutUrl,
}: HouseholdDeletionReminderEmailProps) {
  const copy = STAGE_COPY[stage];
  return (
    <EmailLayout previewText={`${copy.headline} — ${householdName}`}>
      <Heading
        style={{
          fontFamily: emailFontStack,
          ...emailType.heading,
          color: emailColors.darkText,
          margin: '8px 0 16px',
        }}>
        {copy.headline}
      </Heading>
      <Text
        style={{
          fontFamily: emailFontStack,
          ...emailType.body,
          color: emailColors.body,
          margin: '0 0 24px',
        }}>
        Hi {firstName(name)}, {copy.body}
      </Text>
      <AlertBox variant={copy.urgency}>{copy.body}</AlertBox>
      <InfoCard
        rows={[
          { label: 'Household', value: householdName },
          { label: 'Deletes on', value: purgeDate },
        ]}
      />
      <PrimaryButton href={recoverUrl}>Cancel deletion</PrimaryButton>
      <SecondaryButton href={optOutUrl}>Stop reminder emails</SecondaryButton>
    </EmailLayout>
  );
}

HouseholdDeletionReminderEmail.PreviewProps = {
  name: 'Alex',
  householdName: 'The Nero Home',
  stage: '7d',
  purgeDate: 'Thu, Nov 5, 2026',
  recoverUrl: 'https://www.choremaxx.app',
  optOutUrl: 'https://www.choremaxx.app',
} satisfies HouseholdDeletionReminderEmailProps;

export const subjectFor = ({
  householdName,
  stage,
}: HouseholdDeletionReminderEmailProps) => {
  const label =
    stage === '7d'
      ? '7 days left'
      : stage === '3d'
        ? '3 days left'
        : stage === '24h'
          ? '24 hours left'
          : 'About 1 hour left';
  return `${label} · ${householdName}`;
};

export const textFor = ({
  name,
  householdName,
  stage,
  purgeDate,
  recoverUrl,
  optOutUrl,
}: HouseholdDeletionReminderEmailProps) => {
  const copy = STAGE_COPY[stage];
  return [
    `Hi ${firstName(name)}, ${copy.body}`,
    '',
    `Household: ${householdName}`,
    `Deletes on: ${purgeDate}`,
    '',
    `Cancel deletion: ${recoverUrl}`,
    `Stop reminder emails: ${optOutUrl}`,
  ].join('\n');
};

export const _module: EmailModule<HouseholdDeletionReminderEmailProps> = {
  default: HouseholdDeletionReminderEmail,
  subjectFor,
  textFor,
};
