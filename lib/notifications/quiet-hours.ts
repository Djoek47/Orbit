/**
 * Quiet hours window — household-local HH:mm.
 * Defaults match house rules (21:00–07:00, wraps midnight).
 */

export const DEFAULT_QUIET_HOURS_START = '21:00';
export const DEFAULT_QUIET_HOURS_END = '07:00';

/** Hourly slots for the Settings picker (00:00 … 23:00). */
export function quietHoursPickerValues(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    out.push(`${String(h).padStart(2, '0')}:00`);
  }
  return out;
}

export function normalizeQuietHm(
  value: string | null | undefined,
  fallback: string
): string {
  const raw = (value ?? '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return fallback;
  const [hStr, mStr] = raw.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallback;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function quietHmToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  return Number(hStr) * 60 + Number(mStr);
}

/**
 * True when local wall time falls inside [start, end).
 * Supports midnight wrap (21:00–07:00) and same-day windows (13:00–15:00).
 * Degenerate start === end → never quiet.
 */
export function isInQuietHoursWindow(input: {
  localHour: number;
  localMinute?: number;
  startHm?: string | null;
  endHm?: string | null;
}): boolean {
  const start = quietHmToMinutes(
    normalizeQuietHm(input.startHm, DEFAULT_QUIET_HOURS_START)
  );
  const end = quietHmToMinutes(normalizeQuietHm(input.endHm, DEFAULT_QUIET_HOURS_END));
  if (start === end) return false;
  const hour = Math.max(0, Math.min(23, Math.floor(input.localHour)));
  const minute = Math.max(0, Math.min(59, Math.floor(input.localMinute ?? 0)));
  const now = hour * 60 + minute;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

/** Compact chip label e.g. "21–7" or "9PM–7AM". */
export function quietHoursChipLabel(
  startHm?: string | null,
  endHm?: string | null,
  use24h = true
): string {
  const start = normalizeQuietHm(startHm, DEFAULT_QUIET_HOURS_START);
  const end = normalizeQuietHm(endHm, DEFAULT_QUIET_HOURS_END);
  if (use24h) {
    return `${Number(start.slice(0, 2))}–${Number(end.slice(0, 2))}`;
  }
  return `${formatQuietHmShort(start)}–${formatQuietHmShort(end)}`;
}

export function formatQuietHmShort(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${suffix}`;
}

export function quietHoursRangeCopy(
  startHm?: string | null,
  endHm?: string | null,
  use24h = true
): string {
  const start = normalizeQuietHm(startHm, DEFAULT_QUIET_HOURS_START);
  const end = normalizeQuietHm(endHm, DEFAULT_QUIET_HOURS_END);
  const a = use24h ? start : formatQuietHmDisplay(start, false);
  const b = use24h ? end : formatQuietHmDisplay(end, false);
  return `${a}–${b}`;
}

export function formatQuietHmDisplay(hhmm: string, use24h = true): string {
  const normalized = normalizeQuietHm(hhmm, DEFAULT_QUIET_HOURS_START);
  if (use24h) return normalized;
  const h = Number(normalized.slice(0, 2));
  const m = normalized.slice(3);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${suffix}`;
}

export function quietHoursBodyCopy(
  startHm?: string | null,
  endHm?: string | null,
  use24h = true
): string {
  const range = quietHoursRangeCopy(startHm, endHm, use24h);
  return `Evenings stay calm ${range}. Time-sensitive asks still get through.`;
}
