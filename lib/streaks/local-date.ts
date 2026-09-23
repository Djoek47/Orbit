/**
 * Household-local calendar date helpers for the streak engine.
 *
 * `localDate` is always a `YYYY-MM-DD` string in household-local time.
 * Production should resolve boundaries with the household IANA timezone.
 * Without date-fns-tz installed, formatLocalDate falls back to the device
 * local calendar date as an approximation.
 */

import {
  addDays,
  format,
  getWeek,
  getWeekYear,
  isSameDay,
  parseISO,
  endOfWeek,
} from 'date-fns';

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a YYYY-MM-DD string as a calendar date (local midnight). */
export function parseLocalDate(localDate: string): Date {
  if (!LOCAL_DATE_RE.test(localDate)) {
    throw new Error(`Invalid localDate: ${localDate}`);
  }
  // parseISO('YYYY-MM-DD') is treated as local midnight by date-fns.
  return parseISO(localDate);
}

/**
 * Format a Date as YYYY-MM-DD.
 * `timeZone` is accepted for API compatibility; without a tz library we use
 * the device local calendar date. Production should pass household IANA tz
 * once date-fns-tz (or equivalent) is available.
 */
export function formatLocalDate(date: Date, timeZone?: string): string {
  if (timeZone) {
    // Approximation until a timezone library is wired: Intl can format the
    // calendar date in the requested zone without date-fns-tz.
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // fall through to device local
    }
  }
  return format(date, 'yyyy-MM-dd');
}

/** Add (or subtract) calendar days to a localDate string. */
export function addLocalDays(localDate: string, n: number): string {
  return format(addDays(parseLocalDate(localDate), n), 'yyyy-MM-dd');
}

/**
 * Week key in 'YYYY-Www' style, respecting household weekStartsOn.
 * Default weekStartsOn = 1 (Monday).
 */
export function weekKey(localDate: string, weekStartsOn: WeekStartsOn = 1): string {
  const date = parseLocalDate(localDate);
  const opts = { weekStartsOn };
  const year = getWeekYear(date, opts);
  const week = getWeek(date, opts);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * True when localDate is the last day of the household week
 * (e.g. Sunday when weekStartsOn = Monday).
 */
export function isWeekCloseDate(localDate: string, weekStartsOn: WeekStartsOn = 1): boolean {
  const date = parseLocalDate(localDate);
  const close = endOfWeek(date, { weekStartsOn });
  return isSameDay(date, close);
}
