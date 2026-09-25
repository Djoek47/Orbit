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
import { addMinutesToTime, minutesBetween, parseWhen } from '@/lib/poppins/when-parse';
import type { IuiBeat, IuiPayload } from '@/lib/poppins/ui-scenes';

export type CardSpeechCtx = {
  memberNames?: string[];
  placeNames?: string[];
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

/** A patch for the card on screen, or null when the sentence is about something else. */
export function interpretCardSpeech(
  text: string,
  beat: IuiBeat | undefined,
  ctx: CardSpeechCtx = {}
): Partial<IuiPayload> | null {
  if (!beat || !text.trim()) return null;
  const rename = renameFromSpeech(text, beat);
  if (rename) return rename;
  // A sentence that starts a new thing is not a correction to this card.
  if (/^(?:and\s+)?(?:also\s+)?(?:add|put|buy|get|assign|schedule|book|plan|remind|clean|wash)\b/i.test(text.trim()) &&
      !/^(?:add|with) travel\b/i.test(text.trim())) {
    return null;
  }
  if (beat.scene === 'calendar_zoom' || beat.payload.write === 'create_event') {
    return eventPatch(text, beat, ctx);
  }
  return null;
}
