/**
 * Household Invitation — no trigger today; invites are code/deep-link based
 * (`lib/invite/deep-links.ts`, `supabase/functions/join-household`). Wire
 * this once a household-level "invite by email" flow exists — e.g. a new
 * `send-household-invite` edge function called when an admin enters an
 * email address instead of sharing a code.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';

export type HouseholdInviteEmailProps = {
  inviterName: string;
  householdName: string;
  acceptUrl: string;
  role?: string;
};

export default function HouseholdInviteEmail({
  inviterName,
  householdName,
  acceptUrl,
  role = 'Member',
}: HouseholdInviteEmailProps) {
  return (
    <EmailLayout previewText={`${inviterName} invited you to join ${householdName} on ChoreMaxx.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.title, color: emailColors.darkText, margin: '8px 0 16px' }}>
        You&apos;ve been invited
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        {inviterName} invited you to join their household on ChoreMaxx.
      </Text>
      <InfoCard
        rows={[
          { label: 'Invited by', value: inviterName },
          { label: 'Household', value: householdName },
          { label: 'Role', value: role },
        ]}
      />
      <PrimaryButton href={acceptUrl}>Accept Invitation</PrimaryButton>
    </EmailLayout>
  );
}

HouseholdInviteEmail.PreviewProps = {
  inviterName: 'Sarah Nguyen',
  householdName: 'The Nguyen Home',
  acceptUrl: 'https://choremaxx.app/join/preview',
  role: 'Member',
} satisfies HouseholdInviteEmailProps;

export const subjectFor = ({ householdName }: HouseholdInviteEmailProps) =>
  `You've been invited to join ${householdName}`;

export const textFor = ({ inviterName, householdName, acceptUrl, role = 'Member' }: HouseholdInviteEmailProps) =>
  [
    `${inviterName} invited you to join their household on ChoreMaxx.`,
    '',
    `Household: ${householdName}`,
    `Role: ${role}`,
    '',
    `Accept Invitation: ${acceptUrl}`,
  ].join('\n');

export const _module: EmailModule<HouseholdInviteEmailProps> = {
  default: HouseholdInviteEmail,
  subjectFor,
  textFor,
};
