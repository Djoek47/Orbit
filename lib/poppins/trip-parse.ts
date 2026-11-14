/**
 * A run of stops out of one sentence (design: "IUI — a trip, six stops").
 *
 *   "practice, then work, shopping on my break, back to work, gym, then pick up the kids"
 *     → Wednesday run · 6 stops · 5h 40m
 *        4:00 PM Soccer practice   Parc Jarry · saved place
 *        5:15 PM Work              1250 René-Lévesque O
 *        7:00 PM Shopping          Your list comes along · 6 items
 *        7:45 PM Back to work      1250 René-Lévesque O
 *        9:00 PM Gym               Économie du Plateau
 *       10:15 PM Pick up the kids  Which address? tap to set
 *
 * Any number of stops. Saved places resolve by name or kind; a stop without an address is
 * fine — it's asked for on the card and can come later. Times are laid out from the start
 * time with a travel gap and a typical stay per kind; a time said for a stop wins.
 */
import { addMinutesToTime, minutesBetween, parseWhen } from '@/lib/poppins/when-parse';
import type { IuiStop } from '@/lib/poppins/ui-scenes';

export type TripPlace = { id: string; name: string; address?: string; kind?: string };

export type TripStopKind = 'practice' | 'work' | 'shop' | 'gym' | 'school' | 'pickup' | 'home' | 'appointment' | 'other';

export type TripParse = {
  title: string;
  date?: string;
  start: string;
  stops: IuiStop[];
};

export const TRAVEL_MIN = 15;

const STAY: Record<TripStopKind, number> = {
  practice: 60,
  work: 90,
  shop: 30,
  gym: 60,
  school: 15,
  pickup: 10,
  home: 30,
  appointment: 45,
  other: 30,
};

const TRIP_CUE = /\b(itinerary|trip|route|errands?|run|road trip|my day|the day)\b/i;
const PLACE_WORD =
  /\b(practice|soccer|hockey|piano|dance|swim|ballet|karate|work|office|shop|shopping|store|grocer(y|ies)|market|costco|walmart|pharmacy|drugstore|bank|post office|library|gym|workout|school|daycare|pick ?up|drop ?off|home|house|mom's|dad's|grandma's|dentist|doctor|vet|gas|car wash|mall|park|church|pool|rink|field)\b/i;

export function kindOfStop(label: string): TripStopKind {
  const t = label.toLowerCase();
  if (/\bpick ?up|drop ?off|collect\b/.test(t)) return 'pickup';
  if (/\b(shop|shopping|store|grocer|market|costco|walmart|mall|pharmacy|drugstore)\b/.test(t)) return 'shop';
  if (/\b(work|office)\b/.test(t)) return 'work';
  if (/\b(gym|workout|fitness|yoga|pool)\b/.test(t)) return 'gym';
  if (/\b(school|daycare)\b/.test(t)) return 'school';
  if (/\b(practice|soccer|hockey|piano|dance|swim|ballet|karate|lesson|rink|field)\b/.test(t)) return 'practice';
  if (/\b(home|house)\b/.test(t)) return 'home';
  if (/\b(dentist|doctor|vet|appointment|clinic)\b/.test(t)) return 'appointment';
  return 'other';
}

function splitStops(body: string): string[] {
  return body
    .replace(/\b(and then|after that|afterwards|followed by|puis|ensuite)\b/gi, ' then ')
    .split(/\s*(?:,|;|\bthen\b)\s*/i)
    .map((part) => part.replace(/^(?:and|first|go to|going to|drive to|head to|stop at|to)\s+/i, '').trim())
    .filter((part) => part.length > 1);
}

/** Is this sentence a run of places? */
export function isTripUtterance(text: string, placeNames: string[] = []): boolean {
  const t = text.trim();
  if (!t) return false;
  const parts = splitStops(t.replace(/^.*?\b(?:itinerary|trip|route|run|errands?)\b[:\s]*(?:is\s+|to\s+)?/i, ''));
  const placeLike = (part: string) =>
    PLACE_WORD.test(part) || placeNames.some((name) => new RegExp(`\\b${escape(name)}\\b`, 'i').test(part));
  const placeCount = parts.filter(placeLike).length;
  if (/\b(plan|build|make|create|set up)\b.*\b(trip|route|itinerary|run|errands?)\b/i.test(t) && parts.length >= 1) return true;
  if (TRIP_CUE.test(t) && /\bthen\b|,/.test(t) && placeCount >= 2) return true;
  // A chain with no cue: "practice, then work, shopping, gym" — most parts are places.
  return parts.length >= 3 && placeCount >= Math.ceil(parts.length * 0.6) && /\bthen\b/i.test(t);
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tidyLabel(raw: string): { label: string; note?: string } {
  let label = raw.trim().replace(/[.!?]+$/, '');
  let note: string | undefined;
  if (/\bon my break\b/i.test(label)) {
    note = 'on your break';
    label = label.replace(/\s*\bon my break\b/i, '');
  }
  label = label
    // "tomorrow go to the dentist" reaches here as "go to the dentist" once the day is gone.
    .replace(/^(?:and\s+)?(?:go|going|drive|head|stop|swing by|drop by|pop over)\s+(?:to|at|by|over to)?\s*/i, '')
    .replace(/^(the|a|an|my|our)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  label = label ? label[0]!.toUpperCase() + label.slice(1) : label;
  return { label, note };
}

function roundUp15(date: Date): string {
  const m = date.getHours() * 60 + date.getMinutes();
  const r = Math.ceil((m + 1) / 15) * 15;
  const h = Math.floor(r / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}

/** Lay out stop times from `start`. A stop's own `fixed` time wins and the rest follow it. */
export function scheduleStops(stops: IuiStop[], start: string): IuiStop[] {
  let clock = start;
  return stops.map((stop, index) => {
    const fixed = (stop as IuiStop & { fixedTime?: string }).fixedTime;
    const at = fixed ?? (index === 0 ? start : clock);
    const stay = stop.stayMin ?? STAY[(stop.kind as TripStopKind) ?? 'other'] ?? 30;
    clock = addMinutesToTime(at, stay + TRAVEL_MIN);
    return { ...stop, time: at };
  });
}

/** "5h 40m" from first arrival to leaving the last stop. */
export function tripSpan(stops: IuiStop[]): string {
  const first = stops[0]?.time;
  const last = stops[stops.length - 1];
  if (!first || !last?.time) return '';
  const total = minutesBetween(first, addMinutesToTime(last.time, last.stayMin ?? STAY[(last.kind as TripStopKind) ?? 'other'] ?? 30));
  const mins = total < 0 ? total + 24 * 60 : total;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

export function resolveStopPlace(
  label: string,
  kind: TripStopKind,
  places: TripPlace[],
  earlier: IuiStop[]
): Pick<IuiStop, 'address' | 'savedPlaceId' | 'placeQuery' | 'needsAddress' | 'note'> {
  const lower = label.toLowerCase();
  // "Back to work" reuses the work stop's place.
  if (/^back to\b/.test(lower)) {
    const again = [...earlier].reverse().find((s) => s.kind === kind && (s.address || s.savedPlaceId));
    if (again) return { address: again.address, savedPlaceId: again.savedPlaceId, placeQuery: again.placeQuery, needsAddress: false };
  }
  const byName = places.find((p) => new RegExp(`\\b${escape(p.name.toLowerCase())}\\b`).test(lower));
  const byKind =
    byName ??
    places.find((p) => {
      const k = (p.kind ?? '').toLowerCase();
      return (
        (kind === 'work' && k === 'work') ||
        (kind === 'school' && k === 'school') ||
        (kind === 'home' && k === 'home') ||
        (kind === 'practice' && k === 'practice') ||
        (kind === 'gym' && (k === 'practice' || /gym/i.test(p.name))) ||
        (kind === 'shop' && (k === 'shop' || k === 'grocery'))
      );
    });
  if (byKind) {
    return {
      address: byKind.address || undefined,
      savedPlaceId: byKind.id,
      placeQuery: byKind.name,
      needsAddress: !byKind.address,
      note: byName ? `${byKind.name} · saved place` : undefined,
    };
  }
  // A pickup without a place names who, not where — ask.
  if (kind === 'pickup') return { needsAddress: true };
  return { placeQuery: label, needsAddress: kind !== 'shop' };
}

export function parseTripUtterance(
  text: string,
  opts: { places?: TripPlace[]; now?: Date } = {}
): TripParse | null {
  const now = opts.now ?? new Date();
  const when = parseWhen(text, now);
  const body = text
    .replace(/^.*?\b(?:itinerary|trip|route|run|errands?)\b[:\s]*(?:is\s+|to\s+|for\s+)?/i, (match) =>
      /\b(itinerary|trip|route|run|errands?)\b/i.test(match) ? '' : match
    )
    .trim();
  const parts = splitStops(body || text);
  const places = opts.places ?? [];
  const stops: IuiStop[] = [];
  parts.forEach((part, index) => {
    const partWhen = parseWhen(part, now);
    const stripped = part
      .replace(/\b(today|tonight|tomorrow|this (morning|afternoon|evening))\b/gi, '')
      .replace(/\b(at|around|by)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
      .replace(/\b(at|around|by)\s+(noon|half \w+|quarter \w+ \w+)\b/gi, '')
      .replace(/^(starting|start|leaving|leave|beginning|from)\b\s*/i, '')
      .trim();
    const { label, note } = tidyLabel(stripped);
    if (!label || /^(plan|build|make|create|trip|route|run)$/i.test(label)) return;
    const kind = kindOfStop(label);
    const place = resolveStopPlace(label, kind, places, stops);
    const stop: IuiStop & { fixedTime?: string } = {
      id: `stop-${index + 1}`,
      label,
      kind,
      category: kind,
      // A break is short; going "back to" somewhere is the rest of a shift, not a full one.
      stayMin: note === 'on your break' ? 30 : /^back to\b/i.test(label) ? 60 : undefined,
      ...place,
      note: place.note ?? note,
    };
    if (partWhen.time && index > 0) stop.fixedTime = partWhen.time;
    stops.push(stop);
  });
  if (stops.length < 1) return null;

  const firstFixed = parseWhen(parts[0] ?? '', now).time;
  // No time said: today starts from now; another day starts at 9 — not "now" on that day.
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const laterDay = Boolean(when.date && when.date !== todayKey);
  const start = firstFixed ?? when.time ?? (laterDay ? '09:00' : roundUp15(now));
  const scheduled = scheduleStops(stops, start);
  const date = when.date;
  const day = date
    ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
    : now;
  const title = `${day.toLocaleString('en', { weekday: 'long' })} run`;
  return { title, date, start, stops: scheduled };
}
