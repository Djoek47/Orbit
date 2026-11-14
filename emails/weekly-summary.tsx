/**
 * Weekly Household Summary — no email dispatch path today. The data already
 * exists as an in-app digest (`poppins-briefing` edge function, `type:
 * 'weekly'` → `ai_briefings`). Wire this by having that function (or a
 * weekly cron) also POST the same payload to a new email-sending function.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { PrimaryButton } from './components/PrimaryButton';
import { StatCard } from './components/StatCard';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type WeeklySummaryEmailProps = {
  name: string;
  householdName: string;
  weekOf: string;
  tasksCompleted: number;
  completionRate: number;
  xpEarned: number;
  topContributor: string;
  timeSavedMinutes: number;
  openUrl: string;
};

export default function WeeklySummaryEmail({
  name,
  householdName,
  weekOf,
  tasksCompleted,
  completionRate,
  xpEarned,
  topContributor,
  timeSavedMinutes,
  openUrl,
}: WeeklySummaryEmailProps) {
  return (
    <EmailLayout previewText={`${householdName}'s week in ChoreMaxx — ${tasksCompleted} tasks done.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 4px' }}>
        Your week at {householdName}
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.caption, color: emailColors.muted, margin: '0 0 20px' }}>
        Week of {weekOf}
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)}, here&apos;s how your household did.
      </Text>
      <StatCard
        stats={[
          { label: 'Tasks completed', value: String(tasksCompleted) },
          { label: 'Completion rate', value: `${completionRate}%` },
          { label: 'XP earned', value: String(xpEarned) },
          { label: 'Time saved', value: `${timeSavedMinutes}m` },
        ]}
      />
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 24px' }}>
        Top contributor this week: <strong>{topContributor}</strong>.
      </Text>
      <PrimaryButton href={openUrl}>Open ChoreMaxx</PrimaryButton>
    </EmailLayout>
  );
}

WeeklySummaryEmail.PreviewProps = {
  name: 'Sarah',
  householdName: 'The Nguyen Home',
  weekOf: 'August 3',
  tasksCompleted: 24,
  completionRate: 86,
  xpEarned: 340,
  topContributor: 'Emma',
  timeSavedMinutes: 95,
  openUrl: 'https://choremaxx.app/open',
} satisfies WeeklySummaryEmailProps;

export const subjectFor = ({ householdName }: WeeklySummaryEmailProps) =>
  `Your weekly summary — ${householdName}`;

export const textFor = ({
  name,
  householdName,
  weekOf,
  tasksCompleted,
  completionRate,
  xpEarned,
  topContributor,
  timeSavedMinutes,
  openUrl,
}: WeeklySummaryEmailProps) =>
  [
    `Your week at ${householdName} (week of ${weekOf})`,
    '',
    `Hi ${firstName(name)}, here's how your household did.`,
    '',
    `Tasks completed: ${tasksCompleted}`,
    `Completion rate: ${completionRate}%`,
    `XP earned: ${xpEarned}`,
    `Time saved: ${timeSavedMinutes}m`,
    `Top contributor: ${topContributor}`,
    '',
    `Open ChoreMaxx: ${openUrl}`,
  ].join('\n');

export const _module: EmailModule<WeeklySummaryEmailProps> = {
  default: WeeklySummaryEmail,
  subjectFor,
  textFor,
};
