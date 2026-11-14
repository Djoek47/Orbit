/**
 * Credit usage breakdown — the same dashboard shape as the completed-tasks one, counting
 * actions instead of chores.
 *
 *   [ D | W | M | 6M | Y ]
 *   AVERAGE
 *   12 actions a day
 *   Sep 24 – 30, 2026
 *   bars, stacked by what spent them, tap one to read it
 *
 * Buckets, span and the tidy axis top are borrowed from lib/tasks/completion-stats so the
 * two charts can never drift apart. What's counted is the act meter (ActEvent) — the same
 * number the household sees as "actions", not provider cost.
 */
import type { ActEvent, ActKind } from '@/lib/ai/act-events';
import { bucketsFor, niceMax, type BreakdownRange } from '@/lib/tasks/completion-stats';

export { BREAKDOWN_RANGES, niceMax, type BreakdownRange } from '@/lib/tasks/completion-stats';

/** What an action was spent on. The groups people recognise, not the internal act kinds. */
export type SpendGroup = 'tasks' | 'groceries' | 'calendar' | 'places' | 'rewards' | 'other';

export const SPEND_META: Record<SpendGroup, { label: string; color: string; moji: string }> = {
  tasks: { label: 'Tasks & chores', color: '#4FA3FF', moji: 'clipboard' },
  groceries: { label: 'Groceries', color: '#7FC24A', moji: 'cart' },
  calendar: { label: 'Calendar', color: '#FF9F1C', moji: 'calendar' },
  places: { label: 'Trips & places', color: '#17B9A0', moji: 'pin' },
  rewards: { label: 'Rewards', color: '#8E7CFF', moji: 'gift' },
  other: { label: 'Everything else', color: '#94A3B8', moji: 'sparkles' },
};

/** Stacking order, bottom → top. */
export const SPEND_ORDER: SpendGroup[] = [
  'tasks',
  'groceries',
  'calendar',
  'places',
  'rewards',
  'other',
];

const GROUP_OF: Record<ActKind, SpendGroup> = {
  task: 'tasks',
  homework: 'tasks',
  complete: 'tasks',
  coach: 'tasks',
  grocery: 'groceries',
  event: 'calendar',
  itinerary_stop: 'places',
  place_save: 'places',
  reward: 'rewards',
};

export function spendGroupOf(kind: ActKind): SpendGroup {
  return GROUP_OF[kind] ?? 'other';
}

export type CreditEvent = {
  at: Date;
  group: SpendGroup;
  /** Actions charged. */
  credits: number;
  /** Whether Poppins spoke back on this one — Max costs more. */
  spoken: boolean;
  by: string;
};

/**
 * Only charged acts count. An undone, vetoed, abandoned or failed act is refunded in the
 * meter, so it must not appear on the chart either.
 */
export function creditEvents(events: ActEvent[]): CreditEvent[] {
  const rows: CreditEvent[] = [];
  for (const event of events) {
    if (event.outcome !== 'committed') continue;
    const credits = Math.max(0, Math.round(event.tokens));
    if (credits <= 0) continue;
    const at = new Date(event.at);
    if (Number.isNaN(at.getTime())) continue;
    rows.push({
      at,
      group: spendGroupOf(event.actKind),
      credits,
      spoken: event.voice === 'spoken',
      by: event.memberName || event.memberId,
    });
  }
  return rows;
}

export type CreditBucket = {
  start: Date;
  end: Date;
  label: string;
  title: string;
  credits: number;
  actions: number;
  byGroup: Partial<Record<SpendGroup, { credits: number; actions: number }>>;
};

export type CreditBreakdown = {
  range: BreakdownRange;
  buckets: CreditBucket[];
  span: string;
  totals: { credits: number; actions: number; spokenCredits: number; quietCredits: number };
  /** Per day for W/M/6M/Y; the total for D. */
  headline: { kind: 'average' | 'total'; credits: number };
  byGroup: { group: SpendGroup; credits: number; actions: number }[];
  byMember: { name: string; credits: number; actions: number }[];
  since: Date;
  /** Busiest bucket, for "your heaviest day" copy. Null when nothing was spent. */
  busiest: CreditBucket | null;
};

export function computeCreditBreakdown(
  events: CreditEvent[],
  range: BreakdownRange,
  now = new Date()
): CreditBreakdown {
  const base = bucketsFor(range, now);
  const buckets: CreditBucket[] = base.map((bucket) => ({
    start: bucket.start,
    end: bucket.end,
    label: bucket.label,
    title: bucket.title,
    credits: 0,
    actions: 0,
    byGroup: {},
  }));
  const since = buckets[0]!.start;
  const until = buckets[buckets.length - 1]!.end;

  const groups = new Map<SpendGroup, { credits: number; actions: number }>();
  const members = new Map<string, { credits: number; actions: number }>();
  let credits = 0;
  let actions = 0;
  let spokenCredits = 0;

  for (const event of events) {
    if (event.at < since || event.at >= until) continue;
    const bucket = buckets.find((b) => event.at >= b.start && event.at < b.end);
    if (!bucket) continue;
    bucket.credits += event.credits;
    bucket.actions += 1;
    const slot = bucket.byGroup[event.group] ?? { credits: 0, actions: 0 };
    slot.credits += event.credits;
    slot.actions += 1;
    bucket.byGroup[event.group] = slot;

    const group = groups.get(event.group) ?? { credits: 0, actions: 0 };
    group.credits += event.credits;
    group.actions += 1;
    groups.set(event.group, group);

    const member = members.get(event.by) ?? { credits: 0, actions: 0 };
    member.credits += event.credits;
    member.actions += 1;
    members.set(event.by, member);

    credits += event.credits;
    actions += 1;
    if (event.spoken) spokenCredits += event.credits;
  }

  const days = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - startOfDay(since).getTime()) / 86_400_000) + 1
  );
  const headline =
    range === 'D'
      ? { kind: 'total' as const, credits }
      : { kind: 'average' as const, credits: credits / days };

  const busiest = buckets.reduce<CreditBucket | null>(
    (best, bucket) => (bucket.credits > 0 && (!best || bucket.credits > best.credits) ? bucket : best),
    null
  );

  return {
    range,
    buckets,
    span: creditSpan(range, buckets, now),
    totals: { credits, actions, spokenCredits, quietCredits: credits - spokenCredits },
    headline,
    byGroup: SPEND_ORDER.filter((g) => groups.has(g))
      .map((g) => ({ group: g, ...groups.get(g)! }))
      .sort((a, b) => b.credits - a.credits),
    byMember: [...members.entries()]
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.credits - a.credits),
    since,
    busiest,
  };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function creditSpan(range: BreakdownRange, buckets: CreditBucket[], now: Date): string {
  const first = buckets[0]!.start;
  const lastEnd = new Date(buckets[buckets.length - 1]!.end);
  lastEnd.setDate(lastEnd.getDate() - 1);
  const last = lastEnd > now ? startOfDay(now) : lastEnd;
  if (range === 'D') return `Today, ${MONTH_SHORT[first.getMonth()]} ${first.getDate()}`;
  if (range === 'Y') {
    return `${MONTH_SHORT[first.getMonth()]} ${first.getFullYear()} – ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  }
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  return sameMonth
    ? `${MONTH_SHORT[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
    : `${MONTH_SHORT[first.getMonth()]} ${first.getDate()} – ${MONTH_SHORT[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
}

/** "12", "4.3" — a daily average reads with one decimal until it's big enough not to need it. */
export function formatCredits(value: number): string {
  if (value >= 10 || Number.isInteger(value)) return String(Math.round(value));
  return value.toFixed(1);
}

/**
 * How long the rest of the month lasts at the current rate. Null when nothing has been
 * spent yet, or when the pace wouldn't run out.
 */
export function daysOfCreditsLeft(remaining: number, perDay: number): number | null {
  if (perDay <= 0 || remaining <= 0) return null;
  return Math.floor(remaining / perDay);
}
