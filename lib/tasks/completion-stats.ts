/**
 * Completed-tasks breakdown — the numbers behind the Health-style dashboard.
 *
 * Two metrics:
 *   - Tasks completed (every completion, including each finished share of a split task).
 *   - Time saved — minutes of chores finished by Sidekicks, at a typical time for each
 *     kind of chore. That's the time an adult didn't spend. Homework and a child's own
 *     hygiene/routine aren't counted as time saved: nobody else would have done them.
 *
 * Ranges (like Health's steps chart):
 *   D  — today, 24 hourly bars
 *   W  — last 7 days, daily bars
 *   M  — last 30 days, daily bars
 *   6M — last 26 weeks, weekly bars (weeks start Monday)
 *   Y  — last 12 months, monthly bars
 * The headline is the daily average for W/M/6M/Y and the total for D — the same way Health
 * reports steps.
 */
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

export type BreakdownRange = 'D' | 'W' | 'M' | '6M' | 'Y';
export const BREAKDOWN_RANGES: BreakdownRange[] = ['D', 'W', 'M', '6M', 'Y'];

export type TaskFamily =
  | 'kitchen'
  | 'cleaning'
  | 'laundry'
  | 'trash'
  | 'outdoors'
  | 'pets'
  | 'routine'
  | 'homework'
  | 'other';

export const FAMILY_META: Record<TaskFamily, { label: string; color: string; moji: string }> = {
  kitchen: { label: 'Kitchen', color: '#F59E0B', moji: 'pan' },
  cleaning: { label: 'Cleaning', color: '#38BDF8', moji: 'broom' },
  laundry: { label: 'Laundry', color: '#A78BFA', moji: 'basket' },
  trash: { label: 'Trash', color: '#94A3B8', moji: 'trashBag' },
  outdoors: { label: 'Outdoors & car', color: '#34D399', moji: 'tree' },
  pets: { label: 'Pets', color: '#FB923C', moji: 'paw' },
  routine: { label: 'Routine', color: '#F472B6', moji: 'toothbrush' },
  homework: { label: 'Homework', color: '#818CF8', moji: 'books' },
  other: { label: 'Other', color: '#64748B', moji: 'check' },
};

/** Stacking order, bottom → top. */
export const FAMILY_ORDER: TaskFamily[] = [
  'kitchen',
  'cleaning',
  'laundry',
  'trash',
  'outdoors',
  'pets',
  'routine',
  'homework',
  'other',
];

const DOMAIN_FAMILY: Record<string, TaskFamily> = {
  kitchen_dining: 'kitchen',
  meals_groceries: 'kitchen',
  bathroom: 'cleaning',
  bedroom: 'cleaning',
  living_shared: 'cleaning',
  floors_deep_cleaning: 'cleaning',
  home_maintenance: 'cleaning',
  laundry: 'laundry',
  trash_recycling: 'trash',
  yard_outdoors: 'outdoors',
  car: 'outdoors',
  pets: 'pets',
  personal_hygiene: 'routine',
  daily_routine: 'routine',
  homework_education: 'homework',
};

/** Typical minutes by kind of chore — an estimate, labelled as one on screen. */
const DOMAIN_MINUTES: Record<string, number> = {
  kitchen_dining: 15,
  meals_groceries: 30,
  bathroom: 20,
  bedroom: 10,
  living_shared: 15,
  floors_deep_cleaning: 30,
  home_maintenance: 20,
  laundry: 20,
  trash_recycling: 5,
  yard_outdoors: 30,
  car: 30,
  pets: 10,
  personal_hygiene: 0,
  daily_routine: 0,
  homework_education: 0,
};

/** Specific chores whose time is well known — checked before the category default. */
const KEYWORD_MINUTES: [RegExp, number][] = [
  [/\b(mow|mowing)\b/i, 45],
  [/\b(shovel|snow)\b/i, 30],
  [/\b(rake|leaves)\b/i, 30],
  [/\bwash (the )?car\b/i, 30],
  [/\b(deep clean|scrub)\b/i, 30],
  [/\b(vacuum|mop)\b/i, 20],
  [/\b(cook|make) (dinner|lunch|breakfast)\b/i, 30],
  [/\bgrocer(y|ies)\b/i, 45],
  [/\b(fold|put away) (the )?laundry\b/i, 15],
  [/\blaundry\b/i, 20],
  [/\b(load|unload|empty) (the )?dishwasher\b/i, 10],
  [/\b(wash|do|dry) (the )?dishes\b/i, 20],
  [/\bwalk (the )?dog\b/i, 20],
  [/\b(feed|water) (the )?(dog|cat|fish|pet|pets|plants)\b/i, 5],
  [/\b(take out|empty) (the )?(trash|garbage|recycling|compost)\b/i, 5],
  [/\bmake (the |your |my |his |her )?bed\b/i, 5],
  [/\bset (the )?table\b/i, 5],
  [/\bclear (the )?table\b/i, 5],
];

export function familyOf(task: Pick<HouseholdTask, 'category' | 'title'>): TaskFamily {
  const byDomain = DOMAIN_FAMILY[task.category];
  if (byDomain) return byDomain;
  if (/homework/i.test(`${task.category} ${task.title}`)) return 'homework';
  return 'other';
}

/** Typical minutes a chore takes. Homework and a child's own routine are 0 on purpose. */
export function minutesForTask(task: Pick<HouseholdTask, 'category' | 'title'>): number {
  const family = familyOf(task);
  if (family === 'homework' || family === 'routine') return 0;
  for (const [re, minutes] of KEYWORD_MINUTES) if (re.test(task.title)) return minutes;
  return DOMAIN_MINUTES[task.category] ?? 15;
}

export type CompletionEvent = {
  at: Date;
  family: TaskFamily;
  /** Minutes an adult didn't spend (0 unless a Sidekick did it). */
  minutesSaved: number;
  by: string;
};

function isSidekick(role: string | null | undefined): boolean {
  return role === 'child' || role === 'sidekick';
}

/** One event per completion — each finished share of a split task counts on its own. */
export function completionEvents(
  tasks: HouseholdTask[],
  members: Pick<HouseholdMember, 'name' | 'role'>[]
): CompletionEvent[] {
  const roleOf = (name: string) => members.find((m) => m.name === name)?.role;
  const events: CompletionEvent[] = [];
  for (const task of tasks) {
    const family = familyOf(task);
    const minutes = minutesForTask(task);
    const shares = task.shares?.filter((share) => share.status === 'Completed') ?? [];
    if (shares.length) {
      const at = task.completedAt ? new Date(task.completedAt) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      // Split work: the chore's time is shared between the people who did it.
      const each = Math.round(minutes / Math.max(1, task.shares?.length ?? 1));
      for (const share of shares) {
        events.push({ at, family, by: share.name, minutesSaved: isSidekick(roleOf(share.name)) ? each : 0 });
      }
      continue;
    }
    if (task.status !== 'Completed' || !task.completedAt) continue;
    const at = new Date(task.completedAt);
    if (Number.isNaN(at.getTime())) continue;
    const by = task.assignee ?? '';
    events.push({ at, family, by, minutesSaved: isSidekick(roleOf(by)) ? minutes : 0 });
  }
  return events;
}

export type Bucket = {
  start: Date;
  end: Date;
  /** Axis label ('' when this bar isn't labelled). */
  label: string;
  /** Header text when this bar is selected ("Thu, Sep 24", "Week of Sep 21", "March"). */
  title: string;
  tasks: number;
  minutesSaved: number;
  byFamily: Partial<Record<TaskFamily, { tasks: number; minutesSaved: number }>>;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dayTitle(d: Date): string {
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}
function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Empty buckets for a range, oldest first, ending at `now`. */
export function bucketsFor(range: BreakdownRange, now: Date): Bucket[] {
  const make = (start: Date, end: Date, label: string, title: string): Bucket => ({
    start,
    end,
    label,
    title,
    tasks: 0,
    minutesSaved: 0,
    byFamily: {},
  });
  const today = startOfDay(now);
  switch (range) {
    case 'D':
      return Array.from({ length: 24 }, (_, h) => {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h + 1);
        return make(start, end, h % 6 === 0 ? hourLabel(h) : '', `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`);
      });
    case 'W':
      return Array.from({ length: 7 }, (_, i) => {
        const start = addDays(today, i - 6);
        return make(start, addDays(start, 1), DAY_SHORT[start.getDay()]!, dayTitle(start));
      });
    case 'M':
      return Array.from({ length: 30 }, (_, i) => {
        const start = addDays(today, i - 29);
        const label = i % 7 === 2 ? `${start.getDate()}` : '';
        return make(start, addDays(start, 1), label, dayTitle(start));
      });
    case '6M': {
      const thisWeek = mondayOf(now);
      return Array.from({ length: 26 }, (_, i) => {
        const start = addDays(thisWeek, (i - 25) * 7);
        const prev = addDays(start, -7);
        const label = i === 0 || prev.getMonth() !== start.getMonth() ? MONTH_SHORT[start.getMonth()]! : '';
        return make(start, addDays(start, 7), label, `Week of ${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`);
      });
    }
    case 'Y':
      return Array.from({ length: 12 }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return make(start, end, MONTH_SHORT[start.getMonth()]!.charAt(0), `${MONTH_LONG[start.getMonth()]} ${start.getFullYear()}`);
      });
  }
}

export type Breakdown = {
  range: BreakdownRange;
  buckets: Bucket[];
  /** "Sep 19 – 25, 2026" / "Today" … */
  span: string;
  totals: { tasks: number; minutesSaved: number; bySidekicks: number };
  /** Per day for W/M/6M/Y; for D this is the total. */
  headline: { kind: 'average' | 'total'; tasks: number; minutesSaved: number };
  byFamily: { family: TaskFamily; tasks: number; minutesSaved: number }[];
  /** Earliest start of the range — fetch history from here. */
  since: Date;
};

function spanOf(range: BreakdownRange, buckets: Bucket[], now: Date): string {
  const first = buckets[0]!.start;
  // A range ends today, even when its last bar (this week, this month) runs past it.
  const lastBarDay = addDays(buckets[buckets.length - 1]!.end, -1);
  const last = lastBarDay > now ? startOfDay(now) : lastBarDay;
  if (range === 'D') return `Today, ${MONTH_SHORT[first.getMonth()]} ${first.getDate()}`;
  if (range === 'Y') {
    return `${MONTH_SHORT[first.getMonth()]} ${first.getFullYear()} – ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  }
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const end = last;
  return sameMonth
    ? `${MONTH_SHORT[first.getMonth()]} ${first.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
    : `${MONTH_SHORT[first.getMonth()]} ${first.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

export function computeBreakdown(
  events: CompletionEvent[],
  range: BreakdownRange,
  now = new Date()
): Breakdown {
  const buckets = bucketsFor(range, now);
  const since = buckets[0]!.start;
  const until = buckets[buckets.length - 1]!.end;
  const family = new Map<TaskFamily, { tasks: number; minutesSaved: number }>();
  let tasks = 0;
  let minutesSaved = 0;
  let bySidekicks = 0;

  for (const event of events) {
    if (event.at < since || event.at >= until) continue;
    const bucket = buckets.find((b) => event.at >= b.start && event.at < b.end);
    if (!bucket) continue;
    bucket.tasks += 1;
    bucket.minutesSaved += event.minutesSaved;
    const slot = bucket.byFamily[event.family] ?? { tasks: 0, minutesSaved: 0 };
    slot.tasks += 1;
    slot.minutesSaved += event.minutesSaved;
    bucket.byFamily[event.family] = slot;

    const total = family.get(event.family) ?? { tasks: 0, minutesSaved: 0 };
    total.tasks += 1;
    total.minutesSaved += event.minutesSaved;
    family.set(event.family, total);

    tasks += 1;
    minutesSaved += event.minutesSaved;
    if (event.minutesSaved > 0) bySidekicks += 1;
  }

  // Days covered so far (a range that includes today counts today as a day).
  const days = Math.max(1, Math.round((startOfDay(now).getTime() - startOfDay(since).getTime()) / 86_400_000) + 1);
  const headline =
    range === 'D'
      ? { kind: 'total' as const, tasks, minutesSaved }
      : { kind: 'average' as const, tasks: tasks / days, minutesSaved: minutesSaved / days };

  return {
    range,
    buckets,
    span: spanOf(range, buckets, now),
    totals: { tasks, minutesSaved, bySidekicks },
    headline,
    byFamily: FAMILY_ORDER.filter((f) => family.has(f))
      .map((f) => ({ family: f, ...family.get(f)! }))
      .sort((a, b) => b.tasks - a.tasks),
    since,
  };
}

/** "3h 20m", "45m", "0m". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

/** A tidy top for the y-axis (Health uses 5,000 / 10,000 / 15,000 style steps). */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  // Steps whose half is a whole number, so the middle gridline reads cleanly.
  for (const step of [1, 2, 3, 4, 6, 8, 10]) {
    const top = step * pow;
    if (top >= value) return top;
  }
  return 10 * pow;
}
