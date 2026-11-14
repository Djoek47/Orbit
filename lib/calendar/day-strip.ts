/**
 * Day strip — the little "THAT AFTERNOON" timeline under a new event.
 *
 * Pure layout: which of the household's events share the new event's day, where each
 * bar sits across the window (0‥1), and the one-line clash sentence. Computed on device,
 * never asked of a model.
 */
import { formatTime12 } from '../poppins/when-parse';

/** The slice of a household event the strip reads. */
export type DayStripSource = {
  id: string;
  title: string;
  date: string;
  time: string;
  startsAt?: string;
  endsAt?: string;
  responsible?: string;
};

export type DayStripItem = {
  id: string;
  title: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** Who it belongs to, for "Mia's piano". */
  who?: string;
};

export type DayStripDraft = {
  title: string;
  /** Minutes after midnight; omit for an all-day event. */
  start?: number;
  end?: number;
  allDay?: boolean;
};

export type DayStripBar = {
  id: string;
  title: string;
  /** 0‥1 across the window. */
  left: number;
  width: number;
  kind: 'new' | 'clash' | 'next' | 'other';
};

export type DayStripLayout = {
  label: 'THAT MORNING' | 'THAT AFTERNOON' | 'THAT EVENING' | 'THAT DAY';
  from: number;
  to: number;
  bars: DayStripBar[];
  sentence: string;
};

export const DEFAULT_EVENT_MINUTES = 60;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The local calendar day (YYYY-MM-DD) an event sits on, or null when it can't be told. */
export function eventLocalDayKey(event: Pick<DayStripSource, 'date' | 'startsAt'>, now = new Date()): string | null {
  if (event.startsAt) {
    const d = new Date(event.startsAt);
    if (!Number.isNaN(d.getTime())) return localKey(d);
  }
  const label = (event.date ?? '').trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (label.startsWith('today')) return localKey(today);
  if (label.startsWith('tomorrow')) {
    today.setDate(today.getDate() + 1);
    return localKey(today);
  }
  // Stored labels look like "Thu, Oct 2" — no year, so take the nearest one.
  const m = label.match(/\b([a-z]{3})[a-z]*\.? (\d{1,2})\b/);
  if (m && MONTHS.includes(m[1]!)) {
    const month = MONTHS.indexOf(m[1]!);
    const candidates = [-1, 0, 1].map((dy) => new Date(now.getFullYear() + dy, month, Number(m[2])));
    candidates.sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()));
    return localKey(candidates[0]!);
  }
  return null;
}

/** "16:30", "4:30 PM", "4 pm" → minutes after midnight. */
export function timeLabelMinutes(label: string | undefined): number | null {
  const m = (label ?? '').trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const mer = m[3]?.toLowerCase();
  if (!m[2] && !mer) return null;
  if (mer?.startsWith('p') && h < 12) h += 12;
  if (mer?.startsWith('a') && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "HH:MM" → minutes. */
export function hhmmToMinutes(time: string | undefined): number | null {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

function minutesToHHMM(total: number) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

/** Household events on `dayKey`, as timed strip items (all-day / untimed ones are dropped). */
export function dayStripItems(
  events: DayStripSource[],
  dayKey: string,
  now = new Date()
): DayStripItem[] {
  const out: DayStripItem[] = [];
  for (const event of events) {
    if (eventLocalDayKey(event, now) !== dayKey) continue;
    let start: number | null = null;
    if (event.startsAt && timeLabelMinutes(event.time) != null) {
      const d = new Date(event.startsAt);
      if (!Number.isNaN(d.getTime())) start = d.getHours() * 60 + d.getMinutes();
    }
    if (start == null) start = timeLabelMinutes(event.time);
    if (start == null) continue;
    let end = start + DEFAULT_EVENT_MINUTES;
    if (event.endsAt) {
      const e = new Date(event.endsAt);
      if (!Number.isNaN(e.getTime()) && localKey(e) === dayKey) {
        const em = e.getHours() * 60 + e.getMinutes();
        if (em > start) end = em;
      }
    }
    out.push({ id: event.id, title: event.title.trim() || 'Event', start, end, who: event.responsible });
  }
  return out.sort((a, b) => a.start - b.start);
}

function clock(minutes: number) {
  return formatTime12(minutesToHHMM(minutes), { compact: true });
}

/** "Mia's piano" — only when the title doesn't already name them. */
export function possessiveTitle(item: Pick<DayStripItem, 'title' | 'who'>): string {
  const who = item.who?.trim();
  const title = item.title.trim();
  if (!who || title.toLowerCase().includes(who.toLowerCase())) return title;
  // Lower the first letter only for ordinary words ("Piano" → "piano", not "PTA").
  const soft = /^[A-Z][a-z]/.test(title) ? title[0]!.toLowerCase() + title.slice(1) : title;
  return `${who}'s ${soft}`;
}

function listTitles(items: DayStripItem[]) {
  const parts = items.slice(0, 2).map((item) => `${item.title} (${clock(item.start)})`);
  if (items.length > 2) parts.push(`${items.length - 2} more`);
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The one-line clash sentence. */
export function clashSentence(draft: DayStripDraft, others: DayStripItem[]): string {
  if (draft.allDay || draft.start == null) {
    if (!others.length) return 'Nothing else that day.';
    return `All day. Also that day: ${listTitles(others)}.`;
  }
  const start = draft.start;
  const end = draft.end != null && draft.end > start ? draft.end : start + DEFAULT_EVENT_MINUTES;
  const clashes = others.filter((item) => item.start < end && item.end > start);
  const next = others.find((item) => item.start >= end);
  const nextLine = next ? ` ${possessiveTitle(next)} is next, at ${clock(next.start)}.` : '';
  if (clashes.length) return `Clashes with ${listTitles(clashes)}.${nextLine}`;
  return `Clashes with nothing.${nextLine}`;
}

function windowFor(start: number | undefined): Pick<DayStripLayout, 'label' | 'from' | 'to'> {
  if (start == null) return { label: 'THAT DAY', from: 7 * 60, to: 21 * 60 };
  if (start < 12 * 60) return { label: 'THAT MORNING', from: 7 * 60, to: 13 * 60 };
  if (start < 17 * 60) return { label: 'THAT AFTERNOON', from: 12 * 60, to: 19 * 60 };
  return { label: 'THAT EVENING', from: 16 * 60, to: 22 * 60 };
}

/** Bars for the strip plus the clash sentence. Bars outside the window are left off. */
export function layoutDayStrip(draft: DayStripDraft, others: DayStripItem[]): DayStripLayout {
  const timed = !draft.allDay && draft.start != null;
  const start = timed ? draft.start! : undefined;
  const end = timed
    ? draft.end != null && draft.end > start! ? draft.end : start! + DEFAULT_EVENT_MINUTES
    : undefined;
  const win = windowFor(start);
  let { from, to } = win;
  if (start != null && start < from) from = Math.max(0, Math.floor(start / 60) * 60);
  if (end != null && end > to) to = Math.min(24 * 60, Math.ceil(end / 60) * 60);
  const span = to - from;

  const place = (a: number, b: number) => {
    const left = Math.max(0, (a - from) / span);
    const right = Math.min(1, (b - from) / span);
    const width = Math.max(0.02, right - left);
    return { left: Math.min(left, 1 - width), width };
  };

  const clashIds = new Set(
    timed ? others.filter((item) => item.start < end! && item.end > start!).map((item) => item.id) : []
  );
  const next = timed ? others.find((item) => item.start >= end!) : undefined;

  const bars: DayStripBar[] = [];
  for (const item of others) {
    if (item.end <= from || item.start >= to) continue;
    bars.push({
      id: item.id,
      title: item.title,
      ...place(item.start, item.end),
      kind: clashIds.has(item.id) ? 'clash' : next?.id === item.id ? 'next' : 'other',
    });
  }
  if (timed) {
    bars.push({ id: 'new', title: draft.title, ...place(start!, end!), kind: 'new' });
  }
  return { label: win.label, from, to, bars, sentence: clashSentence(draft, others) };
}

/** "16:30"+"17:15" → "4:30 – 5:15 PM"; "11:30"+"12:15" → "11:30 AM – 12:15 PM". */
export function timeRangeLabel(start: string | undefined, end?: string): string {
  if (!start) return '';
  const a = formatTime12(start, { compact: true });
  if (!end) return a;
  const b = formatTime12(end, { compact: true });
  const [aClock, aMer] = a.split(' ');
  const [, bMer] = b.split(' ');
  return aMer === bMer ? `${aClock} – ${b}` : `${a} – ${b}`;
}
