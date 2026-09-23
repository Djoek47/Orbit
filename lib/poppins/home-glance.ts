/**
 * Home glance — two short sentences from live household facts.
 * Wording shifts every two hours. It never uses a stored AI paragraph.
 */

import { greetingWord } from '@/lib/time/greeting';
import { isTodayTask } from '@/lib/tasks/today';
import { getTaskAssignees, taskMatchesAssignee } from '@/lib/tasks/split-assign';
import type { GroceryItem, HouseholdTask } from '@/types/orbit';

export type HomeGlanceKind = 'morningBrief' | 'eveningWrap';

export type HomeGlance = {
  message: string;
  kind: HomeGlanceKind;
};

type GlanceEvent = {
  title: string;
  time?: string;
};

type ComposeHomeGlanceInput = {
  now?: Date;
  firstName: string;
  memberName: string;
  /** Admins see the house. Everyone else hears about their own tasks. */
  householdView: boolean;
  tasks: HouseholdTask[];
  missingGroceries: Pick<GroceryItem, 'name' | 'status'>[];
  nextEvent?: GlanceEvent | null;
  pendingApprovals?: number;
  timeZone?: string;
};

const CLOSERS = [
  'Poppins will speak up if something else needs you.',
  "That's the short version from Poppins.",
  'Poppins is keeping watch on the rest.',
  'Poppins has the rest of the picture.',
];

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Milliseconds until the next two-hour wording change. */
export function msUntilNextHomeGlance(now = new Date()): number {
  const next = new Date(now);
  const hour = now.getHours();
  const nextHour = Math.floor(hour / 2) * 2 + 2;
  next.setHours(nextHour, 0, 0, 0);
  if (nextHour >= 24) next.setDate(next.getDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

function closer(now: Date): string {
  const slot = Math.floor(now.getHours() / 2);
  return CLOSERS[slot % CLOSERS.length] ?? CLOSERS[0];
}

function whoLine(task: HouseholdTask, memberName: string): string {
  if (taskMatchesAssignee(task, memberName)) return 'yours';
  const names = getTaskAssignees(task).map(firstNameOf).filter(Boolean);
  if (names.length === 0) return 'open';
  if (names.length === 1) return `with ${names[0]}`;
  return `with ${names[0]} and ${names[1]}`;
}

export function composeHomeGlance(input: ComposeHomeGlanceInput): HomeGlance {
  const now = input.now ?? new Date();
  const greeting = greetingWord(now);
  const kind: HomeGlanceKind = now.getHours() >= 17 ? 'eveningWrap' : 'morningBrief';
  const name = firstNameOf(input.firstName) || 'there';
  const zone = input.timeZone;

  const today = input.tasks.filter((task) => isTodayTask(task, now, zone));
  const scoped = input.householdView
    ? today
    : today.filter(
        (task) =>
          taskMatchesAssignee(task, input.memberName) || taskMatchesAssignee(task, input.firstName)
      );
  const open = scoped.filter((task) => task.status !== 'Completed');
  const overdue = open.filter((task) => task.status === 'Overdue');
  const done = scoped.filter((task) => task.status === 'Completed').length;
  const total = scoped.length;
  const missing = input.missingGroceries.filter((item) => item.status === 'Missing' || item.status === 'Low');
  const lead = overdue[0] ?? open[0];

  const bits: string[] = [];

  if (lead) {
    const owner = whoLine(lead, input.memberName);
    if (overdue.length > 0) {
      bits.push(
        overdue.length === 1
          ? `${lead.title} is overdue, and it's ${owner}.`
          : `${plural(overdue.length, 'task')} are overdue, starting with ${lead.title}.`
      );
    } else if (open.length === 1 && total > 1) {
      bits.push(
        `${done} of ${total} ${total === 1 ? 'task is' : 'tasks are'} done. ${lead.title} is still ${owner}.`
      );
    } else if (open.length === 1) {
      bits.push(`${lead.title} is still ${owner}.`);
    } else {
      bits.push(
        `${plural(open.length, 'task')} still open, including ${lead.title}.`
      );
    }
  } else if (total > 0) {
    bits.push(input.householdView ? "Today's tasks are done." : "You're done for today.");
  }

  if ((input.pendingApprovals ?? 0) > 0 && input.householdView) {
    const n = input.pendingApprovals ?? 0;
    bits.push(`${plural(n, 'photo')} waiting for a look.`);
  } else if (missing.length > 0) {
    const first = missing[0]?.name;
    bits.push(
      missing.length === 1 && first
        ? `${first} is on the grocery list.`
        : `${plural(missing.length, 'grocery')} still on the list.`
    );
  } else if (input.nextEvent?.title && bits.length < 2) {
    const when = input.nextEvent.time?.trim();
    bits.push(
      when
        ? `${input.nextEvent.title} is at ${when.replace(/^0/, '')}.`
        : `${input.nextEvent.title} is on the calendar.`
    );
  }

  if (bits.length === 0) {
    bits.push('Nothing is due, the grocery list is clear, and the calendar is quiet.');
  }

  const body = bits.slice(0, 2).join(' ');
  return {
    kind,
    message: `${greeting}, ${name}. ${body} ${closer(now)}`,
  };
}
