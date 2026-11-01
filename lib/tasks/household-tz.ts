/**
 * Household IANA timezone helpers for day keys and expiry boundaries.
 * Avoids `new Date(y, m, d, h, mi)` which uses runtime-local time (UTC on Edge).
 */

export const DEFAULT_HOUSEHOLD_TIMEZONE = 'America/Toronto';

export function resolveHouseholdTimezone(timezone?: string | null): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_HOUSEHOLD_TIMEZONE;
}

/** Calendar YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimezone(date: Date, timezone: string): string {
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

/** Add calendar days to a YYYY-MM-DD key (pure date arithmetic). */
export function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function parseHm(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(':').map(Number);
  return {
    hours: Number.isFinite(h) ? h : 0,
    minutes: Number.isFinite(m) ? m : 0,
  };
}

/** Wall-clock hour/minute in timezone for an instant. */
export function wallClockInTimezone(
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

/**
 * UTC Date for dateKey at HH:MM:SS.mmm wall time in timezone.
 * Iterative probe (same approach as lib/scoring/expiry.ts).
 */
export function wallTimeToUtc(
  dateKey: string,
  hm: string,
  timezone: string,
  extras?: { seconds?: number; ms?: number }
): Date {
  const { hours, minutes } = parseHm(hm);
  const seconds = extras?.seconds ?? 0;
  const ms = extras?.ms ?? 0;
  let guess = Date.parse(`${dateKey}T12:00:00.000Z`);
  for (let i = 0; i < 64; i++) {
    const wall = wallClockInTimezone(new Date(guess), timezone);
    if (wall.dateKey !== dateKey) {
      guess += (wall.dateKey < dateKey ? 1 : -1) * 3_600_000;
      continue;
    }
    const targetSec = hours * 3600 + minutes * 60 + seconds;
    const actualSec = wall.hours * 3600 + wall.minutes * 60 + wall.seconds;
    const deltaSec = targetSec - actualSec;
    if (deltaSec === 0) {
      return new Date(guess + ms);
    }
    guess += deltaSec * 1000;
  }
  return new Date(guess + ms);
}

/** Inclusive end of occurrence day at expiryHm:59.999 in household TZ. */
export function expiryInstantInTimezone(
  dateKey: string,
  expiryHm: string,
  timezone: string
): Date {
  return wallTimeToUtc(dateKey, expiryHm, timezone, { seconds: 59, ms: 999 });
}

/** True when household-local wall clock is at or past dailyDeadline HH:MM. */
export function isPastDailyDeadline(
  now: Date,
  dailyDeadlineHm: string,
  timezone: string
): boolean {
  const wall = wallClockInTimezone(now, timezone);
  const { hours, minutes } = parseHm(dailyDeadlineHm);
  return wall.hours * 60 + wall.minutes >= hours * 60 + minutes;
}
