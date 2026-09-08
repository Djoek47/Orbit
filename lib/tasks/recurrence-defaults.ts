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

/** Next due datetime at 19:00 local for a library frequency (§5.1). */
export function dueAtForFrequency(
  frequency: string,
  from = new Date(),
  dueTimeLocal = DEFAULT_DUE_TIME_LOCAL
): Date | null {
  const { hours, minutes } = parseLocalHm(dueTimeLocal);
  const at = (y: number, m: number, d: number) => {
    const dt = new Date(y, m, d, hours, minutes, 0, 0);
    return dt;
  };

  switch (frequency) {
    case 'seasonal':
    case 'as_needed':
      return null;
    case 'none':
      return at(from.getFullYear(), from.getMonth(), from.getDate());
    case 'daily':
      return at(from.getFullYear(), from.getMonth(), from.getDate());
    case 'weekdays': {
      const day = from.getDay();
      if (day === 0 || day === 6) {
        const daysUntilMon = day === 0 ? 1 : 2;
        const next = new Date(from);
        next.setDate(from.getDate() + daysUntilMon);
        return at(next.getFullYear(), next.getMonth(), next.getDate());
      }
      return at(from.getFullYear(), from.getMonth(), from.getDate());
    }
    case '2x_weekly': {
      // TODO(product): §13B.2 Wed+Sat
      const target = DEFAULT_2X_WEEKLY_DAYS[0];
      const next = new Date(from);
      const delta = (target - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + delta);
      return at(next.getFullYear(), next.getMonth(), next.getDate());
    }
    case 'weekly':
    case 'biweekly': {
      const next = new Date(from);
      const delta = (0 - next.getDay() + 7) % 7; // Sunday
      next.setDate(next.getDate() + delta);
      return at(next.getFullYear(), next.getMonth(), next.getDate());
    }
    case 'monthly': {
      const sun = lastSundayOfMonth(from.getFullYear(), from.getMonth());
      if (sun.getTime() < from.getTime()) {
        const nextMonth = from.getMonth() + 1;
        const y = from.getFullYear() + Math.floor(nextMonth / 12);
        const m = ((nextMonth % 12) + 12) % 12;
        const later = lastSundayOfMonth(y, m);
        return at(later.getFullYear(), later.getMonth(), later.getDate());
      }
      return at(sun.getFullYear(), sun.getMonth(), sun.getDate());
    }
    case 'quarterly': {
      const quarterEndMonth = Math.floor(from.getMonth() / 3) * 3 + 2;
      let sun = lastSundayOfMonth(from.getFullYear(), quarterEndMonth);
      if (sun.getTime() < from.getTime()) {
        const nextQ = quarterEndMonth + 3;
        const y = from.getFullYear() + Math.floor(nextQ / 12);
        const m = nextQ % 12;
        sun = lastSundayOfMonth(y, m);
      }
      return at(sun.getFullYear(), sun.getMonth(), sun.getDate());
    }
    default:
      return at(from.getFullYear(), from.getMonth(), from.getDate());
  }
}
