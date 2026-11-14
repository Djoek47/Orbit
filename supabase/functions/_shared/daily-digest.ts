/**
 * The daily digest: what each person is told at 8am and 6pm, their local time.
 *
 * Pure functions, no network and no model — the copy is built from the household's own rows,
 * so a digest costs nothing per household per day. The wording rotates through a few shapes
 * keyed on the date, so the same sentence doesn't arrive every morning.
 *
 * Morning is the plan for the day. Evening is what's left of it.
 */

export const DIGEST_SLOT_HOURS = { morning: 8, evening: 18 } as const;
export type DigestSlot = keyof typeof DIGEST_SLOT_HOURS;

export type DigestTask = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  assigneeMemberId: string | null;
};

export type DigestPerson = {
  memberId: string;
  name: string;
};

export type DigestMessage = {
  memberId: string;
  title: string;
  body: string;
  /** Tasks the message is about, so a tap can open the right place. */
  taskIds: string[];
};

const DONE = new Set(['completed', 'done', 'approved']);

/** The local calendar day (YYYY-MM-DD) in a household's timezone. */
export function localDay(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** The local hour (0–23) in a household's timezone. */
export function localHour(now: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getUTCHours());
    return hour === 24 ? 0 : hour;
  } catch {
    return now.getUTCHours();
  }
}

/** Which digest, if any, is due for this household right now. */
export function slotForHour(hour: number): DigestSlot | null {
  if (hour === DIGEST_SLOT_HOURS.morning) return 'morning';
  if (hour === DIGEST_SLOT_HOURS.evening) return 'evening';
  return null;
}

/** A task counts for a day when it is due on that day in the household's timezone. */
export function dueOnDay(task: DigestTask, day: string, timezone: string): boolean {
  if (!task.dueAt) return false;
  const at = new Date(task.dueAt);
  if (Number.isNaN(at.getTime())) return false;
  return localDay(at, timezone) === day;
}

export function isOpen(task: DigestTask): boolean {
  return !DONE.has(task.status.toLowerCase());
}

/** Stable per-day rotation, so wording varies day to day but not within a day. */
function pick<T>(options: readonly T[], day: string, memberId: string): T {
  let hash = 0;
  for (const ch of `${day}:${memberId}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return options[hash % options.length]!;
}

function list(titles: string[]): string {
  if (titles.length === 1) return titles[0]!;
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

const MORNING_SOME = [
  (n: number, w: string) => `${n === 1 ? '1 thing' : `${n} things`} today: ${w}.`,
  (n: number, w: string) => `Today you have ${w}.`,
  (n: number, w: string) => `On your list today: ${w}.`,
] as const;

const MORNING_NONE = [
  'Nothing on your list today.',
  'Your list is clear today.',
  'No tasks for you today.',
] as const;

const EVENING_SOME = [
  (n: number, w: string) => `${n === 1 ? '1 thing' : `${n} things`} still to do: ${w}.`,
  (n: number, w: string) => `Still open tonight: ${w}.`,
  (n: number, w: string) => `Not done yet: ${w}.`,
] as const;

const EVENING_CLEARED = [
  'Everything on your list is done.',
  'You finished everything today.',
  'All clear — nothing left today.',
] as const;

/** Evening with nothing due at all: say nothing rather than invent a win. */
const EVENING_EMPTY = [
  'Nothing was on your list today.',
  'No tasks were due for you today.',
] as const;

/** At most this many task names in one message; the rest become "and N more". */
const MAX_NAMED = 3;

function names(tasks: DigestTask[]): string {
  const titles = tasks.slice(0, MAX_NAMED).map((t) => t.title.trim()).filter(Boolean);
  const rest = tasks.length - titles.length;
  if (rest > 0) titles.push(rest === 1 ? '1 more' : `${rest} more`);
  return list(titles);
}

/**
 * One message per person. Everyone in `people` gets one, including people with an empty day —
 * a clear day is worth saying, and the push function still honours each household's settings.
 */
export function buildDigest(input: {
  slot: DigestSlot;
  people: DigestPerson[];
  tasks: DigestTask[];
  timezone: string;
  now: Date;
}): DigestMessage[] {
  const { slot, people, tasks, timezone, now } = input;
  const day = localDay(now, timezone);
  const today = tasks.filter((t) => dueOnDay(t, day, timezone));

  return people.map((person) => {
    const mine = today.filter((t) => t.assigneeMemberId === person.memberId);
    const open = mine.filter(isOpen);
    const taskIds = (slot === 'morning' ? mine : open).map((t) => t.id);

    if (slot === 'morning') {
      const body = mine.length
        ? pick(MORNING_SOME, day, person.memberId)(mine.length, names(mine))
        : pick(MORNING_NONE, day, person.memberId);
      return { memberId: person.memberId, title: 'Today', body, taskIds };
    }

    const body = open.length
      ? pick(EVENING_SOME, day, person.memberId)(open.length, names(open))
      : mine.length
        ? pick(EVENING_CLEARED, day, person.memberId)
        : pick(EVENING_EMPTY, day, person.memberId);
    return { memberId: person.memberId, title: 'Tonight', body, taskIds };
  });
}

// ── Slacking: a task expired more than 3 days ago and still not done ────────────────────────

export const SLACKING_AFTER_DAYS = 3;
/** Expired tasks are purged after 7 days; past that there's nothing left to nudge about. */
export const SLACKING_UNTIL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SlackingTask = {
  id: string;
  title: string;
  status: string;
  expiredAt: string | null;
  dueAt: string | null;
  assigneeMemberId: string | null;
};

export type SlackingMessage = {
  taskId: string;
  /** Who it goes to. */
  memberIds: string[];
  title: string;
  body: string;
};

const EXPIRED_STATUSES = new Set(['expired', 'missed', 'overdue']);

/** Whole days since the task expired, or null when it has no date to go by. */
export function daysExpired(task: SlackingTask, now: Date): number | null {
  const stamp = task.expiredAt ?? task.dueAt;
  if (!stamp) return null;
  const at = new Date(stamp).getTime();
  if (Number.isNaN(at)) return null;
  return Math.floor((now.getTime() - at) / DAY_MS);
}

export function isSlacking(task: SlackingTask, now: Date): boolean {
  if (!EXPIRED_STATUSES.has(task.status.toLowerCase())) return false;
  const days = daysExpired(task, now);
  if (days === null) return false;
  const ms = now.getTime() - new Date((task.expiredAt ?? task.dueAt)!).getTime();
  return ms > SLACKING_AFTER_DAYS * DAY_MS && days < SLACKING_UNTIL_DAYS;
}

/**
 * One nudge per slacking task, sent once (the caller skips tasks already nudged): to the
 * person it's assigned to, and to the household's admins so they can follow up. A task with
 * no assignee goes to the admins only.
 */
export function buildSlackingNudges(input: {
  tasks: SlackingTask[];
  people: Array<DigestPerson & { isAdmin: boolean }>;
  alreadyNudged: Set<string>;
  now: Date;
}): SlackingMessage[] {
  const { tasks, people, alreadyNudged, now } = input;
  const admins = people.filter((p) => p.isAdmin);
  const byId = new Map(people.map((p) => [p.memberId, p]));
  const out: SlackingMessage[] = [];

  for (const task of tasks) {
    if (alreadyNudged.has(task.id) || !isSlacking(task, now)) continue;
    const days = daysExpired(task, now)!;
    const title = task.title.trim() || 'A task';
    const assignee = task.assigneeMemberId ? byId.get(task.assigneeMemberId) : undefined;

    if (assignee) {
      out.push({
        taskId: task.id,
        memberIds: [assignee.memberId],
        title: 'Still waiting',
        body: `${title} expired ${days} days ago and isn't done yet.`,
      });
    }
    const adminIds = admins.map((a) => a.memberId).filter((id) => id !== assignee?.memberId);
    if (adminIds.length) {
      out.push({
        taskId: task.id,
        memberIds: adminIds,
        title: 'Falling behind',
        body: assignee
          ? `${assignee.name} hasn't done ${title}. It expired ${days} days ago.`
          : `${title} expired ${days} days ago and nobody has done it.`,
      });
    }
  }
  return out;
}
