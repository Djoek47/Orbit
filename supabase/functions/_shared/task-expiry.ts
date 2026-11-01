/**
 * Server-side task expiry for Sidekick sync (service role).
 * Mirrors lib/tasks/expire-at-boundary.ts — keep logic aligned.
 * Boundaries use household IANA timezone (never Deno/runtime local).
 */

const OPEN = new Set(['pending', 'in_progress', 'overdue']);
const EXPIRED = new Set(['expired', 'missed']);
const DEFAULT_EXPIRY_HM = '23:59';
const DEFAULT_TIMEZONE = 'America/Toronto';

export type DbTaskRow = {
  id: string;
  status: string;
  assignee_name: string;
  due_label: string;
  due_at?: string | null;
  occurrence_date?: string | null;
  expired_at?: string | null;
};

export type DbMemberRow = {
  id: string;
  display_name?: string | null;
};

export type DbRecessRow = {
  member_id: string;
  start_date: string;
  end_date?: string | null;
};

function resolveTimezone(timezone?: string | null): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_TIMEZONE;
}

function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function parseLocalHm(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

function wallClockInTimezone(
  date: Date,
  timezone: string
): { dateKey: string; hours: number; minutes: number; seconds: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return {
    dateKey: `${y}-${m}-${d}`,
    hours: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minutes: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
    seconds: Number(parts.find((p) => p.type === 'second')?.value ?? 0),
  };
}

function expiryInstantInTimezone(dateKey: string, expiryHm: string, timezone: string): Date {
  const { hours, minutes } = parseLocalHm(expiryHm);
  let guess = Date.parse(`${dateKey}T12:00:00.000Z`);
  for (let i = 0; i < 64; i++) {
    const wall = wallClockInTimezone(new Date(guess), timezone);
    if (wall.dateKey !== dateKey) {
      guess += (wall.dateKey < dateKey ? 1 : -1) * 3_600_000;
      continue;
    }
    const targetSec = hours * 3600 + minutes * 60 + 59;
    const actualSec = wall.hours * 3600 + wall.minutes * 60 + wall.seconds;
    const deltaSec = targetSec - actualSec;
    if (deltaSec === 0) {
      return new Date(guess + 999);
    }
    guess += deltaSec * 1000;
  }
  return new Date(guess + 999);
}

function resolveOccurrenceDate(task: DbTaskRow, now: Date, timezone: string): string | null {
  if (task.occurrence_date?.trim()) return task.occurrence_date.trim();
  if (task.due_at?.trim()) {
    const due = new Date(task.due_at);
    if (!Number.isNaN(due.getTime())) return formatDateInTimezone(due, timezone);
  }
  const today = formatDateInTimezone(now, timezone);
  if (/tomorrow/i.test(task.due_label)) {
    const [y, m, d] = today.split('-').map(Number);
    const next = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  }
  if (/today/i.test(task.due_label)) return today;
  if (/yesterday/i.test(task.due_label)) {
    const [y, m, d] = today.split('-').map(Number);
    const prev = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) - 1));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
  }
  return null;
}

function isOnRecess(
  periods: DbRecessRow[],
  memberId: string,
  localDate: string
): boolean {
  return periods.some(
    (p) =>
      p.member_id === memberId &&
      localDate >= p.start_date &&
      (p.end_date == null || localDate <= p.end_date)
  );
}

function memberNameToId(members: DbMemberRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    const name = member.display_name?.trim();
    if (name) map.set(name, member.id);
  }
  return map;
}

/** Returns task rows that should be persisted as expired. */
export function expireOpenDbTasksAtBoundary(
  tasks: DbTaskRow[],
  now: Date,
  input: {
    expiryHm?: string;
    timezone?: string | null;
    members: DbMemberRow[];
    recessPeriods: DbRecessRow[];
  }
): { expired: DbTaskRow[]; expiredAt: string } {
  const expiryHm = input.expiryHm ?? DEFAULT_EXPIRY_HM;
  const timezone = resolveTimezone(input.timezone);
  const expiredAt = now.toISOString();
  const nameToId = memberNameToId(input.members);
  const todayKey = formatDateInTimezone(now, timezone);
  const expired: DbTaskRow[] = [];

  for (const task of tasks) {
    const status = task.status.toLowerCase();
    if (!OPEN.has(status) || EXPIRED.has(status)) continue;

    const dateKey = resolveOccurrenceDate(task, now, timezone);
    if (!dateKey || dateKey > todayKey) continue;
    if (now.getTime() <= expiryInstantInTimezone(dateKey, expiryHm, timezone).getTime()) {
      continue;
    }

    const assigneeName = task.assignee_name?.trim();
    if (assigneeName) {
      const memberId = nameToId.get(assigneeName);
      if (memberId && isOnRecess(input.recessPeriods, memberId, dateKey)) {
        continue;
      }
    }

    expired.push({
      ...task,
      status: 'expired',
      expired_at: task.expired_at ?? expiredAt,
    });
  }

  return { expired, expiredAt };
}
