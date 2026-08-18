/**
 * Task expiry at house-rules constants.expiryTime (DEAD-04), household-local.
 */

import { EXPIRY_HOUR, EXPIRY_MINUTE } from '@/constants/scoring';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { parseLocalHm } from '@/lib/tasks/recurrence-defaults';

function expiryHourMinute(): { hour: number; minute: number } {
  try {
    const { hours, minutes } = parseLocalHm(getHouseRulesDoc().constants.expiryTime);
    return { hour: hours, minute: minutes };
  } catch {
    return { hour: EXPIRY_HOUR, minute: EXPIRY_MINUTE };
  }
}

export type OccurrenceStatus = 'pending' | 'late' | 'completed' | 'expired';

/** End of the due calendar day in household-local wall time → UTC Date. */
export function endOfDueDayUtc(input: {
  /** Due instant (any time that day). */
  dueAt: Date | string;
  /** IANA timezone, e.g. America/Toronto. */
  timezone: string;
}): Date {
  const due = typeof input.dueAt === 'string' ? new Date(input.dueAt) : input.dueAt;
  // Format the due instant in household TZ to get Y-M-D, then build 23:59:59 local.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: input.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(due);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  // Construct as a wall-time string and resolve via a midday probe + offset.
  // Simpler portable approach: iterate — find UTC ms whose TZ wall clock is 23:59:59 that day.
  const targetLabel = `${y}-${m}-${d}`;
  // Start guess: UTC noon that calendar day
  let guess = Date.parse(`${targetLabel}T12:00:00.000Z`);
  for (let i = 0; i < 48; i++) {
    const label = new Intl.DateTimeFormat('en-CA', {
      timeZone: input.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const hy = label.find((p) => p.type === 'year')?.value;
    const hm = label.find((p) => p.type === 'month')?.value;
    const hd = label.find((p) => p.type === 'day')?.value;
    const hh = Number(label.find((p) => p.type === 'hour')?.value ?? 0);
    const mi = Number(label.find((p) => p.type === 'minute')?.value ?? 0);
    const ss = Number(label.find((p) => p.type === 'second')?.value ?? 0);
    const dayMatch = `${hy}-${hm}-${hd}` === targetLabel;
    const { hour: expiryHour, minute: expiryMinute } = expiryHourMinute();
    if (dayMatch && hh === expiryHour && mi === expiryMinute && ss === 59) {
      return new Date(guess);
    }
    if (!dayMatch) {
      // nudge toward target day
      guess += (`${hy}-${hm}-${hd}`! < targetLabel ? 1 : -1) * 3_600_000;
      continue;
    }
    const deltaSec =
      expiryHour * 3600 + expiryMinute * 60 + 59 - (hh * 3600 + mi * 60 + ss);
    guess += deltaSec * 1000;
  }
  return new Date(guess);
}

export function isPastExpiry(input: {
  dueAt: Date | string;
  timezone: string;
  now?: Date | string;
}): boolean {
  const now = input.now
    ? typeof input.now === 'string'
      ? new Date(input.now)
      : input.now
    : new Date();
  return now.getTime() > endOfDueDayUtc(input).getTime();
}

/**
 * Idempotent rollover: pending/late past expiry → expired.
 * Completed rows are untouched. Already-expired rows stay expired.
 */
export function applyExpiryRollover<
  T extends { status: OccurrenceStatus; dueAt?: string | null },
>(rows: T[], timezone: string, now: Date | string = new Date()): T[] {
  return rows.map((row) => {
    if (row.status === 'completed' || row.status === 'expired') return row;
    if (!row.dueAt) return row;
    if (!isPastExpiry({ dueAt: row.dueAt, timezone, now })) return row;
    return { ...row, status: 'expired' as const };
  });
}

/** Completing an expired task is forbidden. */
export function assertCompletable(status: OccurrenceStatus): void {
  if (status === 'expired') {
    throw new Error('Task expired — cannot be completed');
  }
}
