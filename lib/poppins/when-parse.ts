/**
 * When — dates and times out of what people actually say.
 *
 *   "next Thursday at half four"   → Thu of next week, 16:30
 *   "saturday at 10"               → this coming Saturday, 10:00
 *   "tomorrow from 4 to 5:30"      → +1 day, 16:00–17:30
 *   "the 14th at noon"             → 14th of this month (or next), 12:00
 *   "demain à 16h30"               → +1 day, 16:30
 *
 * Pure and deterministic: `now` is injected. Returns the pieces it recognised plus the
 * spans it consumed, so the caller can lift a clean title out of the rest of the sentence.
 */

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export type WhenParse = {
  /** Local calendar day, YYYY-MM-DD. */
  date?: string;
  /** How the day was said — a weekday or relative word, or a calendar date. */
  dateSource?: 'relative' | 'weekday' | 'calendar';
  /** 24-hour HH:MM. */
  time?: string;
  /** 24-hour HH:MM, when a range or a duration was said. */
  endTime?: string;
  durationMin?: number;
  /** True when AM/PM was inferred rather than said. */
  timeGuessed?: boolean;
  partOfDay?: PartOfDay;
  allDay?: boolean;
  /** Lower-cased spans of the input that were read as date/time words. */
  spans: string[];
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, dimanche: 0,
  monday: 1, mon: 1, lundi: 1,
  tuesday: 2, tue: 2, tues: 2, mardi: 2,
  wednesday: 3, wed: 3, mercredi: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, jeudi: 4,
  friday: 5, fri: 5, vendredi: 5,
  saturday: 6, sat: 6, samedi: 6,
};

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, janvier: 0,
  february: 1, feb: 1, fevrier: 1, 'février': 1,
  march: 2, mar: 2, mars: 2,
  april: 3, apr: 3, avril: 3,
  may: 4, mai: 4,
  june: 5, jun: 5, juin: 5,
  july: 6, jul: 6, juillet: 6,
  august: 7, aug: 7, aout: 7, 'août': 7,
  september: 8, sep: 8, sept: 8, septembre: 8,
  october: 9, oct: 9, octobre: 9,
  november: 10, nov: 10, novembre: 10,
  december: 11, dec: 11, decembre: 11, 'décembre': 11,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12,
};

const MINUTE_WORDS: Record<string, number> = {
  "o'clock": 0, oclock: 0, fifteen: 15, thirty: 30, 'forty-five': 45, 'forty five': 45,
  'ten': 10, twenty: 20, 'twenty-five': 25, 'twenty five': 25, 'fifty': 50,
};

const HOUR = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

function hourValue(raw: string): number | undefined {
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw.toLowerCase()];
  return n != null && n >= 0 && n <= 24 ? n : undefined;
}

/** Normalise curly quotes, dashes and doubled spaces so the patterns stay simple. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function partOfDayIn(text: string): PartOfDay | undefined {
  if (/\b(tonight|this evening|in the evening|evening|ce soir|le soir)\b/.test(text)) return 'evening';
  if (/\b(night)\b/.test(text)) return 'night';
  if (/\b(this afternoon|in the afternoon|afternoon|après-midi|apres-midi|cet après-midi)\b/.test(text)) {
    return 'afternoon';
  }
  if (/\b(this morning|in the morning|morning|ce matin|le matin)\b/.test(text)) return 'morning';
  return undefined;
}

/** 12-hour clock → 24-hour, inferring AM/PM for a household day when it wasn't said. */
function to24(
  hour: number,
  minute: number,
  meridiem: 'am' | 'pm' | undefined,
  part: PartOfDay | undefined
): { hh: number; guessed: boolean } {
  if (hour > 12) return { hh: hour % 24, guessed: false };
  if (meridiem === 'am') return { hh: hour === 12 ? 0 : hour, guessed: false };
  if (meridiem === 'pm') return { hh: hour === 12 ? 12 : hour + 12, guessed: false };
  if (part === 'morning') return { hh: hour === 12 ? 0 : hour, guessed: false };
  if (part === 'afternoon' || part === 'evening' || part === 'night') {
    return { hh: hour === 12 ? 12 : hour + 12, guessed: false };
  }
  // Unsaid: family life happens 7 am – 9 pm. 1–6 are afternoon, 7–11 morning, 12 is noon.
  if (hour === 12) return { hh: 12, guessed: true };
  if (hour >= 1 && hour <= 6) return { hh: hour + 12, guessed: true };
  return { hh: hour, guessed: true };
}

function hhmm(h: number, m: number) {
  return `${pad(h)}:${pad(m)}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = ((h! * 60 + m! + minutes) % 1440 + 1440) % 1440;
  return hhmm(Math.floor(total / 60), total % 60);
}

export function minutesBetween(from: string, to: string): number {
  const [h1, m1] = from.split(':').map(Number);
  const [h2, m2] = to.split(':').map(Number);
  return h2! * 60 + m2! - (h1! * 60 + m1!);
}

/** "16:30" → "4:30 PM"; "09:00" → "9 AM" when `compact`. */
export function formatTime12(time?: string, opts?: { compact?: boolean }): string {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return time ?? '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h! >= 12 ? 'PM' : 'AM';
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  if (opts?.compact && m === 0) return `${hour} ${suffix}`;
  return `${hour}:${pad(m!)} ${suffix}`;
}

/** "2026-10-02" → Date at local midnight. */
export function parseDateKey(key?: string): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, mo, d] = key.split('-').map(Number);
  const out = new Date(y!, mo! - 1, d!);
  return Number.isNaN(out.getTime()) ? null : out;
}

type Hit = { value: number; span: string; source: WhenParse['dateSource'] };

function findDay(text: string, now: Date): Hit | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let m: RegExpMatchArray | null;

  if ((m = text.match(/\b(the )?day after tomorrow\b|\bapr[eè]s[- ]demain\b/))) {
    return { value: addDays(today, 2).getTime(), span: m[0], source: 'relative' };
  }
  if ((m = text.match(/\b(tomorrow|tmrw|tmr|demain)( morning| afternoon| evening| night| matin| soir)?\b/))) {
    return { value: addDays(today, 1).getTime(), span: m[1]!, source: 'relative' };
  }
  if ((m = text.match(/\b(today|tonight|this (morning|afternoon|evening)|aujourd'hui|ce soir|ce matin)\b/))) {
    return { value: today.getTime(), span: m[0], source: 'relative' };
  }
  if ((m = text.match(/\bin (a|one|two|three|four|five|six|\d+) (day|days|week|weeks)\b/))) {
    const n = m[1] === 'a' ? 1 : hourValue(m[1]!) ?? 1;
    const days = m[2]!.startsWith('week') ? n * 7 : n;
    return { value: addDays(today, days).getTime(), span: m[0], source: 'relative' };
  }

  // "next thursday" = the Thursday of next week; "this thursday"/"thursday" = the coming one.
  const wd = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp(`\\b(next|this|coming|this coming|on)?\\s*(${wd})\\b(?:\\s+(prochain))?`);
  if ((m = text.match(re))) {
    const target = WEEKDAYS[m[2]!]!;
    const qualifier = m[1];
    const nextFr = Boolean(m[3]);
    const dow = today.getDay();
    const delta = (target - dow + 7) % 7; // 0..6, 0 = today
    if (qualifier === 'next' || nextFr) {
      // Monday-start weeks: land in the week after this one.
      const mondayThis = addDays(today, -((dow + 6) % 7));
      const mondayNext = addDays(mondayThis, 7);
      const offset = (target + 6) % 7; // Mon=0 … Sun=6
      const d = addDays(mondayNext, offset);
      return { value: d.getTime(), span: m[0].trim(), source: 'weekday' };
    }
    return { value: addDays(today, delta).getTime(), span: m[0].trim(), source: 'weekday' };
  }

  // Calendar dates: "october 2", "oct 2nd", "2 october", "le 2 octobre", "the 14th".
  const mo = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  const monthFirst = new RegExp(`\\b(${mo})\\.? (\\d{1,2})(st|nd|rd|th)?\\b`);
  const dayFirst = new RegExp(`\\b(?:the |le )?(\\d{1,2})(st|nd|rd|th|er)? (?:of )?(${mo})\\b`);
  let month: number | undefined;
  let day: number | undefined;
  let span = '';
  if ((m = text.match(monthFirst))) {
    month = MONTHS[m[1]!];
    day = Number(m[2]);
    span = m[0];
  } else if ((m = text.match(dayFirst))) {
    month = MONTHS[m[3]!];
    day = Number(m[1]);
    span = m[0];
  } else if ((m = text.match(/\b(?:on )?the (\d{1,2})(st|nd|rd|th)\b|\ble (\d{1,2})(er)?\b(?! ?h)/))) {
    day = Number(m[1] ?? m[3]);
    span = m[0];
  } else if ((m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return { value: d.getTime(), span: m[0], source: 'calendar' };
  }
  if (day != null && day >= 1 && day <= 31) {
    let year = today.getFullYear();
    let mIdx = month ?? today.getMonth();
    let d = new Date(year, mIdx, day);
    if (d.getTime() < today.getTime()) {
      if (month == null) {
        mIdx += 1;
      } else {
        year += 1;
      }
      d = new Date(year, mIdx, day);
    }
    return { value: d.getTime(), span, source: 'calendar' };
  }
  return null;
}

type TimeHit = { h: number; m: number; guessed: boolean; span: string };

function findTimes(text: string, part: PartOfDay | undefined): TimeHit[] {
  const out: TimeHit[] = [];
  const taken: Array<[number, number]> = [];
  const push = (index: number, span: string, h: number, m: number, mer?: 'am' | 'pm') => {
    const end = index + span.length;
    if (taken.some(([a, b]) => index < b && end > a)) return;
    const { hh, guessed } = to24(h, m, mer, part);
    taken.push([index, end]);
    out.push({ h: hh, m, guessed, span: span.trim() });
  };
  const all = (re: RegExp) => [...text.matchAll(re)];

  for (const m of all(/\b(noon|midday|midi)\b/g)) push(m.index!, m[0], 12, 0, 'pm');
  for (const m of all(/\b(midnight|minuit)\b/g)) push(m.index!, m[0], 12, 0, 'am');
  // "half four", "half past four"
  for (const m of all(new RegExp(`\\bhalf (?:past )?${HOUR}\\b( ?(am|pm|a\\.m\\.|p\\.m\\.))?`, 'g'))) {
    const h = hourValue(m[1]!);
    if (h != null) push(m.index!, m[0], h, 30, m[3]?.startsWith('a') ? 'am' : m[3] ? 'pm' : undefined);
  }
  for (const m of all(new RegExp(`\\bquarter past ${HOUR}\\b`, 'g'))) {
    const h = hourValue(m[1]!);
    if (h != null) push(m.index!, m[0], h, 15);
  }
  for (const m of all(new RegExp(`\\bquarter (?:to|til|till) ${HOUR}\\b`, 'g'))) {
    const h = hourValue(m[1]!);
    if (h != null) push(m.index!, m[0], h === 1 ? 12 : h - 1, 45);
  }
  // 16h30, 16 h, 9h
  for (const m of all(/\b(\d{1,2}) ?h ?(\d{2})?\b/g)) {
    const h = Number(m[1]);
    if (h <= 24) push(m.index!, m[0], h, m[2] ? Number(m[2]) : 0, h >= 13 ? undefined : undefined);
  }
  // 4:30 pm, 16:30, 4.30pm
  for (const m of all(/\b(\d{1,2})[:.](\d{2}) ?(am|pm|a\.m\.|p\.m\.)?/g)) {
    const mer = m[3] ? (m[3].startsWith('a') ? 'am' : 'pm') : undefined;
    push(m.index!, m[0], Number(m[1]), Number(m[2]), mer);
  }
  // 4pm, 4 pm, 4 o'clock, four o'clock, four thirty
  for (const m of all(new RegExp(`\\b${HOUR} ?(am|pm|a\\.m\\.|p\\.m\\.|o'clock|oclock)\\b`, 'g'))) {
    const h = hourValue(m[1]!);
    const mer = m[2]!.startsWith('a') ? 'am' : m[2]!.startsWith('p') ? 'pm' : undefined;
    if (h != null) push(m.index!, m[0], h, 0, mer);
  }
  for (const m of all(new RegExp(`\\b${HOUR} (fifteen|thirty|forty[- ]five|twenty|ten|fifty)\\b`, 'g'))) {
    const h = hourValue(m[1]!);
    const min = MINUTE_WORDS[m[2]!.replace(' ', '-')] ?? MINUTE_WORDS[m[2]!];
    if (h != null && h <= 12 && min != null) push(m.index!, m[0], h, min);
  }
  // Hyphen ranges: "6-7", "4-5pm", "6 - 7:30".
  for (const m of all(/\b(\d{1,2})(?::(\d{2}))? ?- ?(\d{1,2})(?::(\d{2}))? ?(am|pm)?\b/g)) {
    const h1 = Number(m[1]);
    const h2 = Number(m[3]);
    if (h1 > 24 || h2 > 24) continue;
    const mer = m[5] as 'am' | 'pm' | undefined;
    // "4-5pm": the meridiem said once covers both ends.
    push(m.index!, `${m[1]}${m[2] ? `:${m[2]}` : ''}`, h1, m[2] ? Number(m[2]) : 0, mer);
    const tail = m[0].slice(m[0].indexOf('-'));
    push(m.index! + m[0].indexOf('-'), tail, h2, m[4] ? Number(m[4]) : 0, mer);
  }
  // Bare hour after a time preposition: "at 4", "from 4 to 5", "until 6", "à 4".
  for (const m of all(new RegExp(`\\b(at|from|to|until|till|til|between|and|à|a|-)\\s?${HOUR}\\b(?!\\s?(days?|weeks?|minutes?|mins?|hours?|stops?|items?|kids?|people))`, 'g'))) {
    const h = hourValue(m[2]!);
    if (h == null || h > 24) continue;
    const start = m.index! + m[0].indexOf(m[2]!);
    // "and" / "to" / "-" only count when a time is already on the line (ranges).
    if (/^(and|to|-)$/.test(m[1]!) && out.length === 0) continue;
    // "à"/"a" only when it's clearly French time context with a number.
    if (/^(a)$/.test(m[1]!) && !/\d/.test(m[2]!)) continue;
    push(start, m[2]!, h, 0);
  }
  return out.sort((a, b) => text.indexOf(a.span) - text.indexOf(b.span));
}

function findDuration(text: string): { minutes: number; span: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\bfor (an|one|a) hour and a half\b/))) return { minutes: 90, span: m[0] };
  if ((m = text.match(/\bfor (an|one|a) (hour|hr)\b/))) return { minutes: 60, span: m[0] };
  if ((m = text.match(/\bfor half an hour\b/))) return { minutes: 30, span: m[0] };
  if ((m = text.match(/\bfor (\d+(?:\.5)?|one|two|three|four|five) ?(hours?|hrs?|h)\b/))) {
    const n = /^\d/.test(m[1]!) ? Number(m[1]) : hourValue(m[1]!) ?? 1;
    return { minutes: Math.round(n * 60), span: m[0] };
  }
  if ((m = text.match(/\bfor (\d+) ?(minutes|mins|min)\b/))) return { minutes: Number(m[1]), span: m[0] };
  return null;
}

export function parseWhen(input: string, now: Date = new Date()): WhenParse {
  const text = normalise(input);
  const spans: string[] = [];
  const out: WhenParse = { spans };

  const part = partOfDayIn(text);
  if (part) out.partOfDay = part;

  if (/\ball[ -]day\b|\btoute la journée\b/.test(text)) {
    out.allDay = true;
    spans.push('all day', 'all-day');
  }

  const day = findDay(text, now);
  if (day) {
    out.date = dateKey(new Date(day.value));
    out.dateSource = day.source;
    spans.push(day.span);
  }
  if (part) {
    const pm = text.match(/\b(tonight|this (morning|afternoon|evening)|in the (morning|afternoon|evening)|ce soir|ce matin)\b/);
    if (pm) spans.push(pm[0]);
  }

  // Remove the date span before looking for times so "the 14th" is not read as 14:00.
  const forTimes = day ? text.replace(day.span, ' ') : text;
  const times = findTimes(forTimes, part);
  if (times[0]) {
    out.time = hhmm(times[0].h, times[0].m);
    if (times[0].guessed) out.timeGuessed = true;
    spans.push(times[0].span);
  }
  if (times[1] && out.time) {
    let end = hhmm(times[1].h, times[1].m);
    // "from 4 to 5" — keep the end after the start when AM/PM was only guessed.
    if (minutesBetween(out.time, end) <= 0 && times[1].guessed) end = addMinutesToTime(end, 12 * 60);
    if (minutesBetween(out.time, end) > 0) {
      out.endTime = end;
      out.durationMin = minutesBetween(out.time, end);
      spans.push(times[1].span);
    }
  }
  const duration = findDuration(text);
  if (duration) {
    out.durationMin = duration.minutes;
    if (out.time && !out.endTime) out.endTime = addMinutesToTime(out.time, duration.minutes);
    spans.push(duration.span);
  }
  return out;
}

/** The sentence with every recognised date/time phrase (and its little glue words) lifted out. */
export function stripWhen(input: string, when: WhenParse): string {
  let text = normalise(input);
  const spans = [...when.spans].filter(Boolean).sort((a, b) => b.length - a.length);
  const W = '[\\p{L}\\p{N}]';
  for (const span of spans) {
    const escaped = span.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^[\p{L}\p{N}]/u.test(span) ? `(?<!${W})` : '';
    const trail = /[\p{L}\p{N}]$/u.test(span) ? `(?!${W})` : '';
    const glue = `(?:(?<!${W})(?:on|at|for|from|to|until|till|by|this|next|à|a|le|the)\\s+)?`;
    text = text.replace(new RegExp(`${glue}${lead}${escaped}${trail}`, 'u'), ' ');
  }
  let out = text.replace(/\s+/g, ' ').trim();
  // Glue left dangling at either end once the time words are gone ("…at", "à", "-").
  for (let i = 0; i < 3; i += 1) {
    out = out
      .replace(/(?:^|\s)(?:from|to|until|till|between|and|at|on|à|a|de|-|–)\s*$/u, '')
      .replace(/^(?:-|–)\s*/u, '')
      .replace(/\s-\s/g, ' ')
      .trim();
  }
  return out;
}

/** "Thu", "2", "Oct" for the date tile. */
export function dateTileParts(key?: string): { weekday: string; day: string; month: string } | null {
  const d = parseDateKey(key);
  if (!d) return null;
  return {
    weekday: d.toLocaleString('en', { weekday: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    month: d.toLocaleString('en', { month: 'short' }).toUpperCase(),
  };
}

/** "Today", "Tomorrow", "Thursday", or "Thu 2 Oct" — for a spoken-back line or a chip. */
export function friendlyDay(key: string | undefined, now: Date = new Date()): string {
  const d = parseDateKey(key);
  if (!d) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleString('en', { weekday: 'long' });
  return `${d.toLocaleString('en', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}
