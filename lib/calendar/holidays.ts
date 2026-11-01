/**
 * Holidays on the Plan calendar. Computed on the phone — no network, no stored rows.
 *
 * A household picks one or more regions (Global is always on). Each region brings its
 * public holidays; "fun" days (Halloween, Valentine's…) and cultural/faith days (Lunar New
 * Year, Diwali, Eid, Hanukkah…) can be switched on or off one by one in Holiday settings.
 *
 * Dates for lunar holidays come from a table (2025–2028) and can shift by a day locally.
 */
import type { MojiName } from '@/components/orbit/moji/art';

export type HolidayRegion = 'global' | 'canada' | 'quebec' | 'us' | 'uk' | 'france' | 'europe';
export type HolidayKind = 'public' | 'fun' | 'cultural';

export type HolidayDef = {
  id: string;
  name: string;
  moji: MojiName;
  kind: HolidayKind;
  regions: HolidayRegion[];
  /** One line shown under the name in Holiday settings and on the day card. */
  blurb: string;
  /** Local date for that year, or null when the holiday doesn't fall that year / is unknown. */
  date: (year: number) => Date | null;
  /** True when the date can move by a day depending on where you are (moon sighting). */
  approximate?: boolean;
};

export type Holiday = Omit<HolidayDef, 'date'> & { dateKey: string; date: Date };

export const HOLIDAY_REGIONS: { id: HolidayRegion; label: string; hint: string }[] = [
  { id: 'global', label: 'Global', hint: 'Halloween, Christmas, New Year and other days most families mark' },
  { id: 'canada', label: 'Canada', hint: 'Statutory holidays across Canada' },
  { id: 'quebec', label: 'Québec', hint: 'Fête nationale, Journée des patriotes' },
  { id: 'us', label: 'United States', hint: 'Federal holidays' },
  { id: 'uk', label: 'United Kingdom', hint: 'Bank holidays' },
  { id: 'france', label: 'France', hint: 'Jours fériés' },
  { id: 'europe', label: 'Europe', hint: 'Days shared across most of Europe' },
];

// ── Date rules ─────────────────────────────────────────────────────────────────────────
const fixed = (month: number, day: number) => (y: number) => new Date(y, month - 1, day);

/** nth weekday of a month (weekday 0 = Sunday). n = -1 for the last one. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month - 1, 1);
    const shift = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month - 1, 1 + shift + (n - 1) * 7);
  }
  const last = new Date(year, month, 0);
  const shift = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, last.getDate() - shift);
}
const nth = (month: number, weekday: number, n: number) => (y: number) => nthWeekday(y, month, weekday, n);

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
const easter = (offset: number) => (y: number) => {
  const d = easterSunday(y);
  d.setDate(d.getDate() + offset);
  return d;
};

/** The Monday before a date (Victoria Day = Monday before May 25). */
const mondayBefore = (month: number, day: number) => (y: number) => {
  const d = new Date(y, month - 1, day - 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
};

/** France: Mother's Day is the last Sunday of May, or the first of June if that's Pentecost. */
const fetesDesMeres = (y: number) => {
  const last = nthWeekday(y, 5, 0, -1);
  const pentecost = easter(49)(y);
  if (last.getTime() === pentecost.getTime()) return nthWeekday(y, 6, 0, 1);
  return last;
};

const table = (rows: Record<number, string>) => (y: number) => {
  const iso = rows[y];
  if (!iso) return null;
  const [yy, mm, dd] = iso.split('-').map(Number);
  return new Date(yy!, mm! - 1, dd!);
};

// ── The list ───────────────────────────────────────────────────────────────────────────
export const HOLIDAYS: HolidayDef[] = [
  // Global — on for everyone by default
  { id: 'new-year', name: 'New Year’s Day', moji: 'fireworks', kind: 'public', regions: ['global'], blurb: 'A fresh start for the whole house.', date: fixed(1, 1) },
  { id: 'valentines', name: 'Valentine’s Day', moji: 'heart', kind: 'fun', regions: ['global'], blurb: 'A little love goes a long way.', date: fixed(2, 14) },
  { id: 'st-patricks', name: 'St. Patrick’s Day', moji: 'shamrock', kind: 'fun', regions: ['global'], blurb: 'Wear something green.', date: fixed(3, 17) },
  { id: 'april-fools', name: 'April Fools’ Day', moji: 'jester', kind: 'fun', regions: ['global'], blurb: 'Keep the pranks kind.', date: fixed(4, 1) },
  { id: 'earth-day', name: 'Earth Day', moji: 'globe', kind: 'fun', regions: ['global'], blurb: 'A good day to sort the recycling together.', date: fixed(4, 22) },
  { id: 'easter', name: 'Easter Sunday', moji: 'easterEgg', kind: 'public', regions: ['global'], blurb: 'Egg hunts and family time.', date: easter(0) },
  { id: 'mothers-day', name: 'Mother’s Day', moji: 'bouquet', kind: 'fun', regions: ['global'], blurb: 'Second Sunday of May in Canada and the US.', date: nth(5, 0, 2) },
  { id: 'fathers-day', name: 'Father’s Day', moji: 'tie', kind: 'fun', regions: ['global'], blurb: 'Third Sunday of June.', date: nth(6, 0, 3) },
  { id: 'halloween', name: 'Halloween', moji: 'pumpkin', kind: 'fun', regions: ['global'], blurb: 'Costumes, candy and a spooky house.', date: fixed(10, 31) },
  { id: 'christmas-eve', name: 'Christmas Eve', moji: 'santaHat', kind: 'fun', regions: ['global'], blurb: 'The night before.', date: fixed(12, 24) },
  { id: 'christmas', name: 'Christmas', moji: 'xmasTree', kind: 'public', regions: ['global'], blurb: 'Merry Christmas from Poppins.', date: fixed(12, 25) },
  { id: 'new-years-eve', name: 'New Year’s Eve', moji: 'champagne', kind: 'fun', regions: ['global'], blurb: 'Count down together.', date: fixed(12, 31) },

  // Cultural & faith — global, off until switched on
  { id: 'lunar-new-year', name: 'Lunar New Year', moji: 'lantern', kind: 'cultural', regions: ['global'], blurb: 'Red lanterns and family dinners.', date: table({ 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26' }) },
  { id: 'ramadan', name: 'Ramadan begins', moji: 'crescent', kind: 'cultural', regions: ['global'], blurb: 'The month of fasting starts.', approximate: true, date: table({ 2025: '2025-03-01', 2026: '2026-02-18', 2027: '2027-02-08', 2028: '2028-01-28' }) },
  { id: 'eid-al-fitr', name: 'Eid al-Fitr', moji: 'crescent', kind: 'cultural', regions: ['global'], blurb: 'The end of Ramadan.', approximate: true, date: table({ 2025: '2025-03-30', 2026: '2026-03-20', 2027: '2027-03-10', 2028: '2028-02-27' }) },
  { id: 'rosh-hashanah', name: 'Rosh Hashanah', moji: 'apple', kind: 'cultural', regions: ['global'], blurb: 'Apples and honey for a sweet year.', date: table({ 2025: '2025-09-23', 2026: '2026-09-12', 2027: '2027-10-02', 2028: '2028-09-21' }) },
  { id: 'diwali', name: 'Diwali', moji: 'diya', kind: 'cultural', regions: ['global'], blurb: 'The festival of lights.', date: table({ 2025: '2025-10-20', 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17' }) },
  { id: 'hanukkah', name: 'Hanukkah begins', moji: 'menorah', kind: 'cultural', regions: ['global'], blurb: 'Eight nights of light.', date: table({ 2025: '2025-12-14', 2026: '2026-12-04', 2027: '2027-12-24', 2028: '2028-12-12' }) },

  // Canada
  { id: 'ca-family-day', name: 'Family Day', moji: 'heartHome', kind: 'public', regions: ['canada'], blurb: 'Most provinces. Québec doesn’t observe it.', date: nth(2, 1, 3) },
  { id: 'ca-good-friday', name: 'Good Friday', moji: 'bread', kind: 'public', regions: ['canada', 'uk'], blurb: 'Statutory holiday.', date: easter(-2) },
  { id: 'ca-easter-monday', name: 'Easter Monday', moji: 'easterEgg', kind: 'public', regions: ['quebec', 'uk', 'france', 'europe'], blurb: 'Day off after Easter.', date: easter(1) },
  { id: 'ca-victoria-day', name: 'Victoria Day', moji: 'crown', kind: 'public', regions: ['canada'], blurb: 'The unofficial start of summer.', date: mondayBefore(5, 25) },
  { id: 'qc-patriotes', name: 'Journée nationale des patriotes', moji: 'fleurDeLis', kind: 'public', regions: ['quebec'], blurb: 'Same Monday as Victoria Day.', date: mondayBefore(5, 25) },
  { id: 'qc-fete-nationale', name: 'Fête nationale du Québec', moji: 'fleurDeLis', kind: 'public', regions: ['quebec'], blurb: 'Saint-Jean-Baptiste.', date: fixed(6, 24) },
  { id: 'ca-canada-day', name: 'Canada Day', moji: 'mapleLeaf', kind: 'public', regions: ['canada'], blurb: 'Happy birthday, Canada.', date: fixed(7, 1) },
  { id: 'ca-civic-holiday', name: 'Civic Holiday', moji: 'sunrise', kind: 'public', regions: ['canada'], blurb: 'Most provinces, first Monday of August.', date: nth(8, 1, 1) },
  { id: 'ca-labour-day', name: 'Labour Day', moji: 'tools', kind: 'public', regions: ['canada'], blurb: 'Back-to-school is around the corner.', date: nth(9, 1, 1) },
  { id: 'ca-truth-reconciliation', name: 'National Day for Truth and Reconciliation', moji: 'orangeHeart', kind: 'public', regions: ['canada'], blurb: 'Every Child Matters.', date: fixed(9, 30) },
  { id: 'ca-thanksgiving', name: 'Thanksgiving (Canada)', moji: 'turkey', kind: 'public', regions: ['canada'], blurb: 'Second Monday of October.', date: nth(10, 1, 2) },
  { id: 'ca-remembrance', name: 'Remembrance Day', moji: 'poppy', kind: 'public', regions: ['canada'], blurb: 'Lest we forget.', date: fixed(11, 11) },
  { id: 'ca-boxing-day', name: 'Boxing Day', moji: 'gift', kind: 'public', regions: ['canada', 'uk', 'europe'], blurb: 'The day after Christmas.', date: fixed(12, 26) },

  // United States
  { id: 'us-mlk', name: 'Martin Luther King Jr. Day', moji: 'mic', kind: 'public', regions: ['us'], blurb: 'Third Monday of January.', date: nth(1, 1, 3) },
  { id: 'us-presidents', name: 'Presidents’ Day', moji: 'medal', kind: 'public', regions: ['us'], blurb: 'Third Monday of February.', date: nth(2, 1, 3) },
  { id: 'us-memorial', name: 'Memorial Day', moji: 'flagUs', kind: 'public', regions: ['us'], blurb: 'Last Monday of May.', date: nth(5, 1, -1) },
  { id: 'us-juneteenth', name: 'Juneteenth', moji: 'star', kind: 'public', regions: ['us'], blurb: 'Freedom Day.', date: fixed(6, 19) },
  { id: 'us-independence', name: 'Independence Day', moji: 'fireworks', kind: 'public', regions: ['us'], blurb: 'Fireworks and barbecues.', date: fixed(7, 4) },
  { id: 'us-labor-day', name: 'Labor Day', moji: 'tools', kind: 'public', regions: ['us'], blurb: 'First Monday of September.', date: nth(9, 1, 1) },
  { id: 'us-indigenous', name: 'Indigenous Peoples’ Day', moji: 'feather', kind: 'public', regions: ['us'], blurb: 'Also Columbus Day. Second Monday of October.', date: nth(10, 1, 2) },
  { id: 'us-veterans', name: 'Veterans Day', moji: 'medal', kind: 'public', regions: ['us'], blurb: 'Thank a veteran.', date: fixed(11, 11) },
  { id: 'us-thanksgiving', name: 'Thanksgiving (US)', moji: 'turkey', kind: 'public', regions: ['us'], blurb: 'Fourth Thursday of November.', date: nth(11, 4, 4) },

  // United Kingdom
  { id: 'uk-mothering-sunday', name: 'Mothering Sunday', moji: 'bouquet', kind: 'fun', regions: ['uk'], blurb: 'Three weeks before Easter.', date: easter(-21) },
  { id: 'uk-early-may', name: 'Early May bank holiday', moji: 'sunrise', kind: 'public', regions: ['uk'], blurb: 'First Monday of May.', date: nth(5, 1, 1) },
  { id: 'uk-spring', name: 'Spring bank holiday', moji: 'seedling', kind: 'public', regions: ['uk'], blurb: 'Last Monday of May.', date: nth(5, 1, -1) },
  { id: 'uk-summer', name: 'Summer bank holiday', moji: 'sunrise', kind: 'public', regions: ['uk'], blurb: 'Last Monday of August.', date: nth(8, 1, -1) },
  { id: 'uk-bonfire', name: 'Bonfire Night', moji: 'fireworks', kind: 'fun', regions: ['uk'], blurb: 'Remember, remember the fifth of November.', date: fixed(11, 5) },

  // France
  { id: 'fr-fete-travail', name: 'Fête du Travail', moji: 'muguet', kind: 'public', regions: ['france', 'europe'], blurb: 'Le 1er mai, avec du muguet.', date: fixed(5, 1) },
  { id: 'fr-victoire', name: 'Victoire 1945', moji: 'dove', kind: 'public', regions: ['france'], blurb: '8 mai.', date: fixed(5, 8) },
  { id: 'fr-ascension', name: 'Ascension', moji: 'dove', kind: 'public', regions: ['france', 'europe'], blurb: 'Jeudi de l’Ascension.', date: easter(39) },
  { id: 'fr-pentecote', name: 'Lundi de Pentecôte', moji: 'dove', kind: 'public', regions: ['france', 'europe'], blurb: 'Whit Monday.', date: easter(50) },
  { id: 'fr-fete-meres', name: 'Fête des mères', moji: 'bouquet', kind: 'fun', regions: ['france'], blurb: 'Dernier dimanche de mai.', date: fetesDesMeres },
  { id: 'fr-14-juillet', name: 'Fête nationale (14 juillet)', moji: 'flagFr', kind: 'public', regions: ['france'], blurb: 'Feu d’artifice ce soir.', date: fixed(7, 14) },
  { id: 'fr-assomption', name: 'Assomption', moji: 'sunrise', kind: 'public', regions: ['france', 'europe'], blurb: '15 août.', date: fixed(8, 15) },
  { id: 'fr-toussaint', name: 'Toussaint', moji: 'candle', kind: 'public', regions: ['france', 'europe'], blurb: 'All Saints’ Day.', date: fixed(11, 1) },
  { id: 'fr-armistice', name: 'Armistice 1918', moji: 'poppy', kind: 'public', regions: ['france'], blurb: '11 novembre.', date: fixed(11, 11) },

  // Europe
  { id: 'eu-europe-day', name: 'Europe Day', moji: 'flagEu', kind: 'fun', regions: ['europe'], blurb: '9 May.', date: fixed(5, 9) },
  { id: 'eu-st-nicholas', name: 'St. Nicholas Day', moji: 'santaHat', kind: 'fun', regions: ['europe'], blurb: 'Shoes by the door the night before.', date: fixed(12, 6) },
];

// ── Preferences ────────────────────────────────────────────────────────────────────────
export type HolidayPrefs = {
  /** Calendar shows holidays at all. */
  enabled: boolean;
  regions: HolidayRegion[];
  /** Per-holiday overrides of the default (public & fun on, cultural off). */
  overrides: Record<string, boolean>;
};

export const DEFAULT_HOLIDAY_PREFS: HolidayPrefs = { enabled: true, regions: ['global'], overrides: {} };

/** A first guess from the phone's region (e.g. "CA", "US", "GB", "FR") and language. */
export function suggestedRegions(regionCode?: string | null, languageCode?: string | null): HolidayRegion[] {
  const r = (regionCode ?? '').toUpperCase();
  const out: HolidayRegion[] = ['global'];
  if (r === 'CA') {
    out.push('canada');
    if ((languageCode ?? '').toLowerCase().startsWith('fr')) out.push('quebec');
  } else if (r === 'US') out.push('us');
  else if (r === 'GB' || r === 'UK') out.push('uk');
  else if (r === 'FR') out.push('france', 'europe');
  else if (['DE', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'SE', 'DK', 'FI', 'PL', 'GR', 'LU', 'CZ'].includes(r)) out.push('europe');
  return out;
}

export function isHolidayOn(def: HolidayDef, prefs: HolidayPrefs): boolean {
  if (!prefs.enabled) return false;
  if (!def.regions.some((r) => prefs.regions.includes(r))) return false;
  const override = prefs.overrides[def.id];
  if (typeof override === 'boolean') return override;
  return def.kind !== 'cultural';
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Holidays switched on for these prefs between two dates (inclusive), keyed by yyyy-MM-dd. */
export function holidaysBetween(start: Date, end: Date, prefs: HolidayPrefs): Record<string, Holiday[]> {
  const map: Record<string, Holiday[]> = {};
  if (!prefs.enabled) return map;
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const seen = new Set<string>();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    for (const def of HOLIDAYS) {
      if (!isHolidayOn(def, prefs)) continue;
      const date = def.date(y);
      if (!date) continue;
      const t = date.getTime();
      if (t < from || t > to) continue;
      const key = dateKeyOf(date);
      // Same name on the same day from two regions (Boxing Day) shows once.
      const dedupe = `${key}:${def.name}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const { date: _rule, ...rest } = def;
      (map[key] ??= []).push({ ...rest, dateKey: key, date });
    }
  }
  return map;
}

/** Next holiday on or after `from`, within a year. */
export function nextHoliday(from: Date, prefs: HolidayPrefs): Holiday | null {
  const end = new Date(from);
  end.setFullYear(end.getFullYear() + 1);
  const map = holidaysBetween(from, end, prefs);
  const first = Object.keys(map).sort()[0];
  return first ? map[first]![0]! : null;
}
