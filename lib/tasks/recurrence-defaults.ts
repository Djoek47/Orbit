/**
 * Recurrence helpers — last Sunday of month, due-time defaults (§5.1).
 * // TODO(product): 2x_weekly defaults Wed+Sat (§13B.2)
 */

/** month is 0-indexed. */
export function lastSundayOfMonth(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = last.getDay();
  return new Date(year, month + 1, 0 - offset);
}

export const DEFAULT_DUE_TIME_LOCAL = '19:00';

/** Default weekday pair for 2x_weekly — Wed(3) + Sat(6). */
export const DEFAULT_2X_WEEKLY_DAYS = [3, 6] as const; // TODO(product): §13B.2

export function parseLocalHm(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(':').map((n) => Number(n));
  return {
    hours: Number.isFinite(h) ? h : 19,
    minutes: Number.isFinite(m) ? m : 0,
  };
}
