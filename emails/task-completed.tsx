/**
 * Task Completed — celebration email. In-app equivalent already exists
 * (`poppinsNotifications.taskCompleted` → in-app `notifications` row). Wire
 * this from the same completion path once email is desired alongside push.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { PrimaryButton } from './components/PrimaryButton';
import { StatCard } from './components/StatCard';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName, pluralize } from './utils/format';

export type TaskCompletedEmailProps = {
  name: string;
  taskTitle: string;
  xpEarned: number;
  streakDays?: number;
  openUrl: string;
};

export default function TaskCompletedEmail({
  name,
  taskTitle,
  xpEarned,
  streakDays,
  openUrl,
}: TaskCompletedEmailProps) {
  return (
    <EmailLayout previewText={`Nice work — ${taskTitle} is done.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        Nicely done, {firstName(name)}
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        You completed <strong>{taskTitle}</strong>.
      </Text>
      {streakDays && streakDays > 1 ? (
        <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
          That&apos;s a {pluralize(streakDays, 'day')} streak — keep it going.
        </Text>
      ) : null}
      <StatCard
        stats={[
          { label: 'XP earned', value: `+${xpEarned}` },
          ...(streakDays ? [{ label: 'Current streak', value: pluralize(streakDays, 'day') }] : []),
        ]}
      />
      <PrimaryButton href={openUrl}>Open ChoreMaxx</PrimaryButton>
    </EmailLayout>
  );
}

TaskCompletedEmail.PreviewProps = {
  name: 'Emma',
  taskTitle: 'Take out the trash',
  xpEarned: 10,
  streakDays: 5,
  openUrl: 'https://choremaxx.app/open',
} satisfies TaskCompletedEmailProps;

export const subjectFor = ({ taskTitle }: TaskCompletedEmailProps) => `Task complete: ${taskTitle}`;

export const textFor = ({ name, taskTitle, xpEarned, streakDays, openUrl }: TaskCompletedEmailProps) =>
  [
    `Nicely done, ${firstName(name)}!`,
    '',
    `You completed ${taskTitle}.`,
    `XP earned: +${xpEarned}`,
    streakDays ? `Current streak: ${pluralize(streakDays, 'day')}` : '',
    '',
    `Open ChoreMaxx: ${openUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

export const _module: EmailModule<TaskCompletedEmailProps> = {
  default: TaskCompletedEmail,
  subjectFor,
  textFor,
};
