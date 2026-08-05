/**
 * Task Assigned — no email trigger today; task creation currently produces
 * in-app state only (`store/orbit-store.tsx` `createTask`). Wire this from
 * `createTask` (or a DB trigger on `household_tasks` insert) once household
 * members have a stored notification email preference.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InfoCard } from './components/InfoCard';
import { PrimaryButton } from './components/PrimaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type TaskAssignedEmailProps = {
  assigneeName: string;
  taskTitle: string;
  dueDate: string;
  priority: string;
  assignedBy: string;
  openTaskUrl: string;
};

export default function TaskAssignedEmail({
  assigneeName,
  taskTitle,
  dueDate,
  priority,
  assignedBy,
  openTaskUrl,
}: TaskAssignedEmailProps) {
  return (
    <EmailLayout previewText={`New task: ${taskTitle}`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 16px' }}>
        New task assigned
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(assigneeName)}, {assignedBy} assigned you a new task.
      </Text>
      <InfoCard
        rows={[
          { label: 'Task', value: taskTitle },
          { label: 'Due', value: dueDate },
          { label: 'Priority', value: priority },
          { label: 'Assigned by', value: assignedBy },
        ]}
      />
      <PrimaryButton href={openTaskUrl}>Open Task</PrimaryButton>
    </EmailLayout>
  );
}

TaskAssignedEmail.PreviewProps = {
  assigneeName: 'Emma',
  taskTitle: 'Take out the trash',
  dueDate: 'Today, 6:00 PM',
  priority: 'Medium',
  assignedBy: 'Sarah',
  openTaskUrl: 'https://choremaxx.app/task/preview',
} satisfies TaskAssignedEmailProps;

export const subjectFor = ({ taskTitle }: TaskAssignedEmailProps) => `New task: ${taskTitle}`;

export const textFor = ({
  assigneeName,
  taskTitle,
  dueDate,
  priority,
  assignedBy,
  openTaskUrl,
}: TaskAssignedEmailProps) =>
  [
    `Hi ${firstName(assigneeName)}, ${assignedBy} assigned you a new task.`,
    '',
    `Task: ${taskTitle}`,
    `Due: ${dueDate}`,
    `Priority: ${priority}`,
    '',
    `Open Task: ${openTaskUrl}`,
  ].join('\n');

export const _module: EmailModule<TaskAssignedEmailProps> = {
  default: TaskAssignedEmail,
  subjectFor,
  textFor,
};
