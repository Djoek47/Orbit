/**
 * Poppins notification batching + quiet hours — Revision D §5.1.
 */

import { DEADLINE_REMINDER_MINUTES } from '@/constants/scoring';
import { VOCAB } from '@/constants/vocabulary';

export type PendingDeadlineTask = {
  id: string;
  memberId: string;
  memberName: string;
  dueAt: string; // ISO
  title: string;
};

export type OutboundNotification = {
  id: string;
  memberId: string;
  recipientIds: string[];
  kind: string;
  title: string;
  body: string;
  sendAt: string; // ISO — may be delayed for quiet hours
  batched: boolean;
};

export type NotificationCategory =
  | 'deadline_reminder'
  | 'task_completed'
  | 'homework_ready'
  | 'proof_requested'
  | 'streak_at_risk'
  | 'streak_outcome'
  | 'crown_awarded'
  | 'reward_ready';

export const DEFAULT_NOTIFICATION_TOGGLES: Record<NotificationCategory, boolean> = {
  deadline_reminder: true,
  task_completed: true,
  homework_ready: true,
  proof_requested: true,
  streak_at_risk: true,
  streak_outcome: true,
  crown_awarded: true,
  reward_ready: true,
};

/** Quiet hours 21:00–07:00 household-local. Deadline reminders still fire (18:30). */
export function isQuietHour(localHour: number): boolean {
  return localHour >= 21 || localHour < 7;
}

/**
 * Queue non-urgent notifications past quiet hours to 07:00 next morning.
 * Deadline reminders are exempt.
 */
export function resolveSendAt(input: {
  generatedAtIso: string;
  localHour: number;
  kind: string;
  nextSevenAmIso: string;
}): string {
  if (input.kind === 'deadline_reminder') return input.generatedAtIso;
  if (isQuietHour(input.localHour)) return input.nextSevenAmIso;
  return input.generatedAtIso;
}

function formatDueLabel(dueAtIso: string): string {
  const d = new Date(dueAtIso);
  // Use UTC so batching tests and household-local converted ISO stay stable.
  let hours = d.getUTCHours();
  const mins = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  if (mins === 0) return `${hours}:00 ${ampm}`;
  return `${hours}:${String(mins).padStart(2, '0')} ${ampm}`;
}

/**
 * Group deadline reminders by (memberId, dueAt) → exactly one notification per group.
 */
export function batchDeadlineReminders(input: {
  tasks: PendingDeadlineTask[];
  sharedDevice?: boolean;
  onRecessMemberIds?: Set<string>;
}): OutboundNotification[] {
  const recess = input.onRecessMemberIds ?? new Set<string>();
  const groups = new Map<string, PendingDeadlineTask[]>();

  for (const task of input.tasks) {
    if (recess.has(task.memberId)) continue;
    const key = `${task.memberId}|${task.dueAt}`;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  const out: OutboundNotification[] = [];
  for (const [, group] of groups) {
    const first = group[0]!;
    const count = group.length;
    const dueLabel = formatDueLabel(first.dueAt);
    const bodyCore = `${count} task${count === 1 ? '' : 's'} due at ${dueLabel}`;
    const title = input.sharedDevice ? `${first.memberName}: ${bodyCore}` : bodyCore;
    out.push({
      id: `deadline_${first.memberId}_${first.dueAt}`,
      memberId: first.memberId,
      recipientIds: [first.memberId],
      kind: 'deadline_reminder',
      title,
      body: title,
      sendAt: first.dueAt, // caller shifts −DEADLINE_REMINDER_MINUTES
      batched: true,
    });
  }
  return out;
}

export function reminderFireIso(dueAtIso: string): string {
  const t = new Date(dueAtIso).getTime() - DEADLINE_REMINDER_MINUTES * 60_000;
  return new Date(t).toISOString();
}

export function crownAwardCopy(memberName: string): string {
  return `${memberName} takes the ${VOCAB.weeksCrown}`;
}

export function streakAtRiskCopy(days: number): string {
  return `Your ${days}-day streak is at risk`;
}
