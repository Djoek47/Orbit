/**
 * One natural-language line → event fields.
 *
 *   "Dentist for Noah next Thursday at half four"
 *     → title "Dentist", member Noah, Thu of next week, 16:30
 *
 * Dates and times come from `when-parse`; this adds who it's for ("for Noah", "Noah's")
 * and gives the title back its original capitals.
 */
import { parseWhen, stripWhen } from '../poppins/when-parse';

export type SentenceMember = { id: string; name: string };

export type EventSentence = {
  title: string;
  /** YYYY-MM-DD */
  dateKey?: string;
  /** HH:MM */
  time?: string;
  endTime?: string;
  durationMin?: number;
  allDay?: boolean;
  timeGuessed?: boolean;
  memberId?: string;
};

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `stripWhen` lower-cases; put the words back as the person typed them. */
function recase(original: string, stripped: string): string {
  const words = original.replace(/[’‘]/g, "'").replace(/[–—]/g, '-').split(/\s+/).filter(Boolean);
  let cursor = 0;
  return stripped
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      for (let i = cursor; i < words.length; i += 1) {
        if (words[i]!.toLowerCase() === word) {
          cursor = i + 1;
          return words[i]!;
        }
      }
      return word;
    })
    .join(' ');
}

function capitalise(text: string) {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

export function readEventSentence(
  sentence: string,
  members: SentenceMember[],
  now: Date = new Date()
): EventSentence {
  const when = parseWhen(sentence, now);
  let title = recase(sentence, stripWhen(sentence, when));

  let memberId: string | undefined;
  // Longest names first so "Mia Rose" wins over "Mia".
  const sorted = [...members].filter((m) => m.name.trim()).sort((a, b) => b.name.length - a.name.length);
  for (const member of sorted) {
    const name = escape(member.name.trim());
    const forRe = new RegExp(`\\s*\\bfor ${name}\\b`, 'i');
    const possRe = new RegExp(`\\b${name}'s?\\s+`, 'i');
    if (forRe.test(title)) {
      title = title.replace(forRe, ' ');
      memberId = member.id;
      break;
    }
    if (possRe.test(title)) {
      title = title.replace(possRe, '');
      memberId = member.id;
      break;
    }
  }

  title = capitalise(
    title
      .replace(/\s+/g, ' ')
      .replace(/^(on|at|for)\s+/i, '')
      .replace(/\s+(on|at|for|from|to|with)$/i, '')
      .trim()
  );

  return {
    title,
    dateKey: when.date,
    time: when.time,
    endTime: when.endTime,
    durationMin: when.durationMin,
    allDay: when.allDay,
    timeGuessed: when.timeGuessed,
    memberId,
  };
}
