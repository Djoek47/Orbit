/**
 * Speech aimed at the card on screen.
 *
 * The general steer (ui-speech.ts) knows yes / no / wait / a name / "and …". This reads a
 * sentence against the card that's actually up, so a follow-up changes that card instead of
 * starting a new one:
 *
 *   any card     "call it deep clean" / "rename it to Dentist checkup"  → title
 *   event        "make it 5" / "Thursday instead" / "at Parc Jarry" / "for Mia" / "all day"
 *                "remind me" / "no reminder"
 *   trip         "tomorrow" / "start at 3" / "add a stop at the bank" / "skip the gym"
 *
 * Returns a patch for the current card, or null when the sentence isn't about it.
 */
import { defaultEventMinutes } from '@/lib/poppins/event-parse';
import { kindOfStop, resolveStopPlace, scheduleStops, type TripPlace } from '@/lib/poppins/trip-parse';
import { addMinutesToTime, minutesBetween, parseWhen } from '@/lib/poppins/when-parse';
import type { IuiBeat, IuiPayload } from '@/lib/poppins/ui-scenes';

export type CardSpeechCtx = {
  memberNames?: string[];
  placeNames?: string[];
  places?: TripPlace[];
  selfName?: string;
  now?: Date;
};

const RENAME =
  /^(?:(?:no|actually|wait)[,\s]+)?(?:call it|call that|name it|rename (?:it|that|this)(?: to)?|change (?:the )?(?:name|title) to|make the (?:name|title)|the (?:name|title) is|it's called|title it|appelle[- ]le|renomme[- ]le(?: en)?)\s+(.+?)[.!?]*$/i;

function capitalise(text: string) {
  const t = text.trim().replace(/^["“']|["”']$/g, '');
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when the sentence only renames the card — its words are a name, not slots. */
export function isRenameSpeech(text: string): boolean {
  return RENAME.test(text.trim());
}

/** "call it deep clean" → "Deep clean", for whatever kind of card is up. */
export function renameFromSpeech(text: string, beat: IuiBeat | undefined): Partial<IuiPayload> | null {
  if (!beat) return null;
  const m = text.trim().match(RENAME);
  if (!m?.[1]) return null;
  const name = capitalise(m[1]);
  if (!name) return null;
  const p = beat.payload;
  if (beat.scene === 'itinerary_stage') return { itineraryTitle: name };
  if (p.write === 'add_grocery' || beat.scene === 'grocery_add') return { groceryName: name, title: name };
  return { title: name, libraryTaskId: undefined, slotSource: { ...(p.slotSource ?? {}), title: 'speech' } };
}

function eventPatch(text: string, beat: IuiBeat, ctx: CardSpeechCtx): Partial<IuiPayload> | null {
  const p = beat.payload;
  const lower = text.toLowerCase();
  const cleaned = text
    .replace(/^(?:(?:no|actually|sorry|oops|wait)[,\s]+)+/i, '')
    .replace(/^(?:make it|move it to|change it to|put it (?:on|at)|let's do|do|how about|instead,?)\s+/i, '')
    .replace(/\s+instead$/i, '');
  // "make it 5" / "5:30" — a bare clock on an event card is a time.
  const when = parseWhen(/^\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?$/i.test(cleaned.trim()) ? `at ${cleaned}` : cleaned, ctx.now);
  const patch: Partial<IuiPayload> = {};

  if (when.date) patch.date = when.date;
  if (when.allDay) {
    patch.allDay = true;
    patch.time = '';
    patch.endTime = undefined;
  } else if (when.time) {
    const oldLength = p.time && p.endTime ? minutesBetween(p.time, p.endTime) : defaultEventMinutes(p.title ?? '');
    patch.time = when.time;
    patch.endTime = when.endTime ?? addMinutesToTime(when.time, oldLength > 0 ? oldLength : 60);
    patch.allDay = false;
    patch.timeGuessed = when.timeGuessed;
  } else if (/^(pm|p\.m\.|in the (afternoon|evening))$/i.test(cleaned.trim()) && p.time) {
    const h = Number(p.time.slice(0, 2));
    if (h < 12) {
      patch.time = addMinutesToTime(p.time, 12 * 60);
      if (p.endTime) patch.endTime = addMinutesToTime(p.endTime, 12 * 60);
      patch.timeGuessed = false;
    }
  } else if (/^(am|a\.m\.|in the morning)$/i.test(cleaned.trim()) && p.time) {
    const h = Number(p.time.slice(0, 2));
    if (h >= 12) {
      patch.time = addMinutesToTime(p.time, -12 * 60);
      if (p.endTime) patch.endTime = addMinutesToTime(p.endTime, -12 * 60);
      patch.timeGuessed = false;
    }
  }
  if (when.durationMin && (patch.time || p.time)) {
    patch.endTime = addMinutesToTime((patch.time ?? p.time)!, when.durationMin);
  }

  // Who.
  const names = (ctx.memberNames ?? []).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const n = escape(name);
    if (new RegExp(`^(?:for\\s+)?${n}$|\\bfor ${n}\\b|\\bpour ${n}\\b|\\bit's ${n}'s\\b`, 'i').test(cleaned)) {
      patch.assignee = name;
      break;
    }
    if (new RegExp(`\\b(?:tell|let) ${n}(?: know)?\\b`, 'i').test(cleaned)) {
      patch.tellWho = name;
      break;
    }
  }
  if (!patch.assignee && ctx.selfName && /\b(for me|it's mine|mine)\b/i.test(cleaned)) patch.assignee = ctx.selfName;

  // Where. A place only when the "at" wasn't a time.
  const places = (ctx.placeNames ?? []).filter(Boolean).sort((a, b) => b.length - a.length);
  const place = places.find((name) => new RegExp(`\\b${escape(name)}\\b`, 'i').test(cleaned));
  if (place) patch.location = place;
  else if (!when.time) {
    const at = cleaned.match(/^(?:it's\s+)?(?:at|@|à)\s+(?:the\s+)?(.{2,60})$/i);
    if (at && !/^\d/.test(at[1]!)) patch.location = capitalise(at[1]!);
  }

  if (/\b(no|without|skip the|don't) remind(er)?\b|\bno reminder\b/.test(lower)) patch.remind = false;
  else if (/\bremind (me|us)\b|\bwith a reminder\b/.test(lower)) patch.remind = true;
  if (/\b(add|with) travel\b|\bdriving time\b/.test(lower)) patch.addTravel = true;

  if (!Object.keys(patch).length) return null;
  const date = patch.date ?? p.date;
  const timeSet = Boolean(patch.time ?? p.time) || Boolean(patch.allDay ?? p.allDay);
  patch.composeReady = Boolean(date) && timeSet;
  patch.focusSlot = !date ? 'date' : !timeSet ? 'time' : null;
  return patch;
}

function tripPatch(text: string, beat: IuiBeat, ctx: CardSpeechCtx): Partial<IuiPayload> | null {
  const p = beat.payload;
  const stops = p.stops ?? [];
  const lower = text.toLowerCase().trim().replace(/[.!?]+$/, '');
  const start = p.time ?? stops[0]?.time ?? '16:00';
  const places = ctx.places ?? [];

  // "tomorrow" / "make it today"
  const day = parseWhen(lower.replace(/^(make it|do it|move it to)\s+/, ''), ctx.now);
  if (/^(?:make it |do it |move it to )?(today|tomorrow|tonight|demain)$/.test(lower) && day.date) {
    return { date: day.date, itineraryTitle: runTitle(day.date) };
  }
  // "start at 3" / "leave at 5:30"
  const startAt = lower.match(/^(?:start|starting|leave|leaving|begin|go)\s+(?:at\s+)?(.+)$/);
  if (startAt) {
    const when = parseWhen(`at ${startAt[1]}`, ctx.now);
    if (when.time) return { time: when.time, stops: scheduleStops(stops, when.time) };
  }
  // "add a stop at the bank" / "add the pharmacy" / "and then the library"
  const add = text.trim().match(/^(?:and\s+)?(?:then\s+)?(?:add|plus)\s+(?:a\s+stop\s+(?:at|to|for)\s+)?(?:the\s+)?(.+?)[.!?]*$/i)
    ?? text.trim().match(/^and then\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (add?.[1] && !/\b(list|groceries|grocery)\b/i.test(add[1])) {
    const label = add[1][0]!.toUpperCase() + add[1].slice(1);
    const kind = kindOfStop(label);
    const place = resolveStopPlace(label, kind, places, stops);
    return { stops: scheduleStops([...stops, { id: `stop-${Date.now()}`, label, kind, category: kind, ...place }], start) };
  }
  // "skip the gym" / "remove the bank" / "no gym"
  const drop = lower.match(/^(?:skip|remove|drop|take out|no|forget)\s+(?:the\s+)?(.+)$/);
  if (drop?.[1]) {
    const target = drop[1];
    const index = stops.findIndex((s) => s.label.toLowerCase().includes(target) || target.includes(s.label.toLowerCase()));
    if (index >= 0 && stops.length > 1) return { stops: scheduleStops(stops.filter((_, i) => i !== index), start) };
  }
  // An address for the stop that's asking: "it's 4200 Rue Beaubien" / "the kids are at Saint-Joseph"
  const asking = stops.find((s) => s.needsAddress && !s.address);
  const address = text.trim().match(/^(?:it's|it is|that's|at|the address is|they're at|the kids are at|c'est au|c'est à)\s+(.+?)[.!?]*$/i);
  if (asking && address?.[1]) {
    return {
      stops: stops.map((s) => (s.id === asking.id ? { ...s, address: address[1], placeQuery: address[1], needsAddress: false } : s)),
    };
  }
  return null;
}

function runTitle(date: string) {
  const d = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  return `${d.toLocaleString('en', { weekday: 'long' })} run`;
}

/** A patch for the card on screen, or null when the sentence is about something else. */
export function interpretCardSpeech(
  text: string,
  beat: IuiBeat | undefined,
  ctx: CardSpeechCtx = {}
): Partial<IuiPayload> | null {
  if (!beat || !text.trim()) return null;
  const rename = renameFromSpeech(text, beat);
  if (rename) return rename;
  if (beat.scene === 'itinerary_stage' || beat.payload.write === 'create_itinerary_stop') {
    const trip = tripPatch(text, beat, ctx);
    if (trip) return trip;
  }
  // A sentence that starts a new thing is not a correction to this card.
  if (/^(?:and\s+)?(?:also\s+)?(?:add|put|buy|get|assign|schedule|book|plan|remind|clean|wash)\b/i.test(text.trim()) &&
      !/^(?:add|with) travel\b/i.test(text.trim())) {
    return null;
  }
  if (beat.scene === 'itinerary_stage' || beat.payload.write === 'create_itinerary_stop') {
    return tripPatch(text, beat, ctx);
  }
  if (beat.scene === 'calendar_zoom' || beat.payload.write === 'create_event') {
    return eventPatch(text, beat, ctx);
  }
  return null;
}
