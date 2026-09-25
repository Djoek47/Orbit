/**
 * A calendar event out of one spoken sentence.
 *
 *   "dentist for Noah next Thursday at half four"
 *     → Dentist · Noah · Thu 1 Oct · 16:30–17:15
 *   "put soccer practice on the calendar saturday at 10 at Parc Jarry"
 *     → Soccer practice · Sat · 10:00–11:30 · Parc Jarry
 *   "Mia has piano monday from 4 to 5"
 *     → Piano · Mia · Mon · 16:00–17:00
 *
 * Dates and times come from `when-parse`. This adds the rest: whether the sentence is about
 * the calendar at all, who it's for, where, the title, and a sensible length.
 */
import { addMinutesToTime, parseWhen, stripWhen, type WhenParse } from '@/lib/poppins/when-parse';

export type EventParse = {
  title: string;
  who?: string;
  /** Other members mentioned with "with …". */
  withWho?: string[];
  date?: string;
  time?: string;
  endTime?: string;
  durationMin?: number;
  allDay?: boolean;
  timeGuessed?: boolean;
  location?: string;
  /** "remind me" was said. */
  remind?: boolean;
  when: WhenParse;
};

export type EventParseOpts = {
  memberNames?: string[];
  /** Saved place names ("School", "Parc Jarry") — a match becomes the location. */
  placeNames?: string[];
  now?: Date;
};

/** Words that make a sentence a calendar sentence on their own. */
const EVENT_NOUNS =
  /\b(calendar|appointment|appt|dentist|orthodontist|doctor|doctor's|pediatrician|physio|therapy|vet|haircut|meeting|conference|interview|lesson|lessons|practice|rehearsal|recital|concert|game|match|tournament|party|birthday|wedding|class|swim|swimming|piano|guitar|violin|dance|karate|soccer|hockey|basketball|baseball|football|tennis|gymnastics|tutoring|playdate|sleepover|field trip|school trip|parent[- ]teacher|pta|pickup day|flight|reservation|dinner reservation|rendez-vous|rdv|réunion|cours|pratique|spectacle|anniversaire)\b/i;

/** Verbs that mean "this goes on the calendar". */
const EVENT_VERBS = /\b(schedule|book|put .* on the calendar|add .* to the calendar|add .* to (my|our|the family) calendar|calendar|save the date)\b/i;

/** Verbs that mean a chore, even with a time ("take out the trash tomorrow at 6"). */
const CHORE_VERBS =
  /\b(clean|wash|wipe|vacuum|mop|sweep|tidy|take out|empty|fold|make (the|his|her|your|my) bed|feed|walk the dog|water|mow|rake|shovel|do the dishes|load|unload|put away|dust|scrub|organi[sz]e|pick up (his|her|your|my|the) (toys|room|clothes))\b/i;

const GROCERY_CUES = /\b(grocery|groceries|shopping list|the list|buy|pick up some|we need|we're out of|we are out of)\b/i;

export function isEventUtterance(text: string, opts: EventParseOpts = {}): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b(itinerary|trip|route|errands|run)\b/i.test(t) && /\bthen\b/i.test(t)) return false;
  if (EVENT_VERBS.test(t)) return true;
  if (GROCERY_CUES.test(t) && !/\bcalendar\b/i.test(t)) return false;
  const when = parseWhen(t, opts.now);
  if (EVENT_NOUNS.test(t)) {
    // "practice the piano" as a chore has no day; an event noun with a day or time is an event.
    return Boolean(when.date || when.time) || /\b(appointment|calendar|meeting|dentist|doctor)\b/i.test(t);
  }
  if (CHORE_VERBS.test(t)) return false;
  // Something at a day and a clock time, not a chore: "Noah's thing thursday at 4".
  return Boolean(when.date && when.time);
}

/** Typical lengths, so "dentist at half four" shows 4:30 – 5:15 without asking. */
export function defaultEventMinutes(title: string): number {
  const t = title.toLowerCase();
  if (/\b(dentist|orthodontist|doctor|pediatrician|vet|haircut|physio|appointment)\b/.test(t)) return 45;
  if (/\b(practice|rehearsal|game|match|tournament|party|birthday|concert|recital)\b/.test(t)) return 90;
  if (/\b(lesson|class|tutoring|swim|piano|guitar|violin|dance|karate|meeting|interview)\b/.test(t)) return 60;
  if (/\b(dinner|lunch|breakfast)\b/.test(t)) return 90;
  return 60;
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `stripWhen` lower-cases; give the kept words their original capitals back. */
function recase(original: string, stripped: string): string {
  const words = original.replace(/[’‘]/g, "'").split(/\s+/).filter(Boolean);
  let cursor = 0;
  return stripped
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      for (let i = cursor; i < words.length; i += 1) {
        if (words[i]!.toLowerCase().replace(/[.,!?]+$/, '') === word) {
          cursor = i + 1;
          return words[i]!.replace(/[.,!?]+$/, '');
        }
      }
      return word;
    })
    .join(' ');
}

function capitalise(text: string) {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

const LEAD_IN =
  /^(?:(?:hey |ok |okay )?poppins[, ]+)?(?:(?:can you|could you|please|i need to|i want to|let's|we need to)\s+)*(?:add|put|schedule|book|create|make|set up|plan|log|note|save|there's|there is|we have|we've got|i have|i've got|remind me about|remind me of|new)?\s*(?:an?|the)?\s*(?:new )?(?:event|appointment for|calendar event)?\s*(?:called|named)?\s*/i;

const CALENDAR_TAIL =
  /\b(?:on|to|in|into) (?:the |my |our )?(?:family |shared |house )?calendar\b|\bto (?:the )?(?:plan|plans)\b/gi;

export function parseEventUtterance(text: string, opts: EventParseOpts = {}): EventParse {
  const now = opts.now ?? new Date();
  const when = parseWhen(text, now);
  let body = recase(text, stripWhen(text, when));
  const remind = /\bremind (me|us)\b|\breminder\b/i.test(text);
  body = body
    .replace(/\b(and )?(remind (me|us)|with a reminder|set a reminder)\b.*$/i, '')
    .replace(CALENDAR_TAIL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  body = body.replace(LEAD_IN, '').trim();

  // Who. Longest names first so "Mia Rose" beats "Mia".
  const members = [...(opts.memberNames ?? [])].filter((n) => n.trim()).sort((a, b) => b.length - a.length);
  let who: string | undefined;
  const withWho: string[] = [];
  for (const member of members) {
    const name = escape(member.trim());
    const patterns: Array<[RegExp, 'who' | 'with']> = [
      [new RegExp(`\\s*\\b(?:for|pour) ${name}\\b`, 'i'), 'who'],
      [new RegExp(`^${name}'?s\\s+`, 'i'), 'who'],
      [new RegExp(`\\b${name}'s\\s+`, 'i'), 'who'],
      [new RegExp(`^${name}\\s+(?:has|have|got|is going to|goes to)\\s+(?:an?\\s+|the\\s+)?`, 'i'), 'who'],
      [new RegExp(`\\s*\\b(?:with|avec) ${name}\\b`, 'i'), 'with'],
      [new RegExp(`\\s*\\band ${name}\\b`, 'i'), 'with'],
    ];
    for (const [re, role] of patterns) {
      if (!re.test(body)) continue;
      body = body.replace(re, ' ').replace(/\s+/g, ' ').trim();
      if (role === 'who' && !who) who = member;
      else if (role === 'with' || who) withWho.push(member);
      break;
    }
  }
  if (!who && /\bfor me\b|\bi have\b|\bmy\b/i.test(text)) who = undefined; // the speaker — resolved at commit
  body = body.replace(/\s*\bfor me\b/i, '').trim();

  // Where: "at <place>" / "@ <place>" left after the time words are gone.
  let location: string | undefined;
  const places = [...(opts.placeNames ?? [])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const place of places) {
    const re = new RegExp(`\\s*\\b(?:at|to|@|à)\\s+(?:the\\s+)?${escape(place)}\\b`, 'i');
    if (re.test(body)) {
      location = place;
      body = body.replace(re, ' ').trim();
      break;
    }
  }
  if (!location) {
    const at = body.match(/\s+(?:at|@|à)\s+((?:the\s+)?[A-Za-zÀ-ÿ0-9'’.\- ]{2,60})$/i);
    if (at && !/^(home|it|that|this|noon|night)$/i.test(at[1]!.trim())) {
      location = capitalise(at[1]!.replace(/^the\s+/i, '').trim());
      body = body.slice(0, at.index).trim();
    }
  }

  let title = body
    .replace(/^(an?|the|some|my|our)\s+/i, '')
    .replace(/\s+(on|at|for|from|to|with|and|this|next|a|an|the)$/i, '')
    .replace(/[.,!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // "dentist appointment" → "Dentist"; a lone "appointment" stays.
  title = title.replace(/^(.+?)\s+(appointment|appt|rendez-vous)\b/i, '$1');
  title = capitalise(title || 'Event');

  const durationMin = when.durationMin ?? (when.time ? defaultEventMinutes(title) : undefined);
  const endTime = when.endTime ?? (when.time && durationMin ? addMinutesToTime(when.time, durationMin) : undefined);

  return {
    title,
    who,
    withWho: withWho.length ? withWho : undefined,
    date: when.date,
    time: when.allDay ? undefined : when.time,
    endTime: when.allDay ? undefined : endTime,
    durationMin: when.allDay ? undefined : durationMin,
    allDay: when.allDay,
    timeGuessed: when.timeGuessed,
    location,
    remind: remind || undefined,
    when,
  };
}
