import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { formatLocalDate } from '@/lib/streaks/local-date';
import type { HouseRulesDoc } from '@/lib/rules/types';

export type DeadlineState = {
  dailyDeadline?: string | null;
  dailyDeadlinePending?: string | null;
  dailyDeadlineAppliesOn?: string | null;
};

/** Promote a queued deadline once its apply-on date arrives. */
export function settleDeadlineState(
  doc: HouseRulesDoc,
  household: DeadlineState,
  now = new Date()
): { dailyDeadline: string; dailyDeadlinePending: string | null; dailyDeadlineAppliesOn: string | null } {
  const fallback = doc.settings.dailyDeadline.default;
  const pending = household.dailyDeadlinePending?.trim() || null;
  const on = household.dailyDeadlineAppliesOn?.trim() || null;
  const current = household.dailyDeadline?.trim() || fallback;
  if (pending && on && formatLocalDate(now) >= on) {
    return { dailyDeadline: pending, dailyDeadlinePending: null, dailyDeadlineAppliesOn: null };
  }
  return {
    dailyDeadline: current,
    dailyDeadlinePending: pending,
    dailyDeadlineAppliesOn: on,
  };
}

/** Deadline in force *today*. A change queued for tomorrow is ignored until appliesOn. */
export function effectiveDailyDeadline(
  doc: HouseRulesDoc,
  household: DeadlineState,
  now = new Date()
): string {
  return settleDeadlineState(doc, household, now).dailyDeadline;
}

export function deadlinePickerValues(doc: HouseRulesDoc): string[] {
  const cfg = doc.settings.dailyDeadline;
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const minM = mins(cfg.min);
  const maxM = mins(cfg.max);
  const out: string[] = [];
  for (let m = minM; m <= maxM; m += cfg.stepMinutes) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    );
  }
  const last = out[out.length - 1];
  if (last !== cfg.max && maxM >= minM && mins(cfg.max) >= minM) {
    out.push(cfg.max);
  }
  return out;
}

export function isValidDailyDeadline(hhmm: string, doc: HouseRulesDoc): boolean {
  const normalized = hhmm.trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) return false;
  return deadlinePickerValues(doc).includes(normalized);
}

export function queueDailyDeadlineChange(
  next: string,
  now = new Date(),
  doc: HouseRulesDoc = getHouseRulesDoc()
): { dailyDeadlinePending: string; dailyDeadlineAppliesOn: string } {
  const hhmm = next.trim();
  if (!isValidDailyDeadline(hhmm, doc)) {
    const { min, max } = doc.settings.dailyDeadline;
    throw new Error(`Daily deadline must be between ${min} and ${max}.`);
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    dailyDeadlinePending: hhmm,
    dailyDeadlineAppliesOn: formatLocalDate(tomorrow),
  };
}
