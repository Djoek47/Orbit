/**
 * Homework, read the way people say it.
 *
 *   "Mia has math homework due tomorrow"            → Math homework · Mia · Tomorrow
 *   "give Mia her science worksheet due thursday"   → Science worksheet · Mia · Thursday
 *   "Noah needs to read chapter 5 by Monday"        → Read chapter 5 · Noah · Monday · Reading
 *   "study for the spelling test, Noah, friday"     → Study for the spelling test · Reading
 *   "math homework for Mia every weekday"           → repeats on weekdays
 *   "…and I want a photo when it's done"            → proof on
 *
 * The title is what was said — never a library chore's title (that's how "math homework"
 * used to become "Practice math facts", repeating on weekdays).
 */
import { parseWhen } from '@/lib/poppins/when-parse';

export type HomeworkRepeat = 'None' | 'Daily' | 'Weekly' | 'Weekdays';

export type HomeworkParse = {
  title: string;
  subject?: string;
  assignee?: string;
  due?: string;
  repeat: HomeworkRepeat;
  /** "with a photo", "photo when it's done", "prove it" — undefined when not mentioned. */
  proof?: boolean;
};

/** Spoken words → the subjects the app knows. Order matters: first hit wins. */
const SUBJECT_WORDS: Array<[RegExp, string]> = [
  [/\b(math|maths|mathematics|algebra|geometry|fractions?|times tables?|multiplication|division|arithmetic|mathématiques|maths?)\b/i, 'Math'],
  [/\b(read|reading|chapter|book report|novel|lecture|lire)\b/i, 'Reading'],
  [/\b(spelling|grammar|writing|essay|english|vocabulary|vocab|anglais)\b/i, 'English'],
  [/\b(french|français|francais|dictée|dictee)\b/i, 'French'],
  [/\b(science|biology|chemistry|physics|lab report|sciences)\b/i, 'Science'],
  [/\b(history|social studies|geography|histoire|géographie)\b/i, 'History'],
  [/\b(art|drawing|painting|arts plastiques)\b/i, 'Art'],
  [/\b(pe|gym class|phys ed|éducation physique)\b/i, 'PE'],
  [/\b(music|piano practice|recorder|musique)\b/i, 'Music'],
];

/** Things a teacher sends home. Any of these makes a sentence homework on its own. */
const WORK_NOUNS =
  /\b(homework|home work|schoolwork|school work|worksheet|assignment|project|essay|book report|lab report|spelling words|spelling list|flash ?cards|study guide|reading log|devoirs?|travail scolaire)\b/i;
/** "read chapter 5", "study for the test", "do pages 10 to 12". */
const WORK_PHRASES =
  /\b(read (chapter|pages?|the book|for \d+ minutes|\d+ pages)|study for|practi[cs]e (spelling|times tables|reading|math)|do (pages?|exercises?|problems?)|math problems|finish (the |his |her |their )?(project|essay|worksheet|assignment))\b/i;
/** Completion — "I finished my math homework" is not a new assignment. */
const DONE_CUE = /\b(i('m| am)? (finished|done)|finished (my|the)|done with (my|the)|i did my|j'ai fini)\b/i;

export function isHomeworkUtterance(text: string): boolean {
  if (DONE_CUE.test(text)) return false;
  return WORK_NOUNS.test(text) || WORK_PHRASES.test(text);
}

export function isHomeworkDoneUtterance(text: string): boolean {
  return DONE_CUE.test(text) && (WORK_NOUNS.test(text) || WORK_PHRASES.test(text) || subjectOf(text) != null);
}

export function subjectOf(text: string): string | undefined {
  for (const [re, subject] of SUBJECT_WORDS) if (re.test(text)) return subject;
  return undefined;
}

function repeatOf(text: string): HomeworkRepeat {
  const t = text.toLowerCase();
  if (/\b(once|one[- ]off|just this (once|time)|une fois)\b/.test(t)) return 'None';
  if (/\b(every (week ?day|school ?day)|weekdays|each school day|school nights?)\b/.test(t)) return 'Weekdays';
  if (/\b(every day|daily|each day|nightly|every night|chaque jour|tous les jours)\b/.test(t)) return 'Daily';
  if (/\b(every week|weekly|each week|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(t)) return 'Weekly';
  return 'None';
}

function proofOf(text: string): boolean | undefined {
  if (/\b(no photo|without (a )?photo|no proof|pas de photo)\b/i.test(text)) return false;
  if (/\b(photo|picture|pic|prove it|proof|show me when|avec photo)\b/i.test(text)) return true;
  return undefined;
}

function capitalise(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The title, from the words that name the work. */
function titleOf(text: string, subject: string | undefined, members: string[]): string {
  let t = text.replace(/[.!?]+$/, '').trim();
  // Drop names, time words and framing so only the work is left to read.
  for (const name of members) t = t.replace(new RegExp(`\\b${escapeRe(name)}('s)?\\b`, 'gi'), ' ');
  t = t
    .replace(/\b(due|by|for|on|before|until)\s+(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week|the weekend)\b/gi, ' ')
    .replace(/\b(today|tonight|tomorrow|this week|next week)\b/gi, ' ')
    .replace(/\b(every (week ?day|school ?day|day|night|week)|weekdays|daily|weekly|once|one[- ]off)\b/gi, ' ')
    .replace(/\b(with|and)?\s*(a )?(photo|picture|pic|proof)( when (it's|it is|they're) done)?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "read chapter 5", "study for the spelling test", "do pages 10 to 12" — keep as said.
  const phrase = t.match(
    /\b(read (?:chapter|pages?|the book|for \d+ minutes|\d+ pages)[\w\s-]*?|study for [\w\s-]+?|practi[cs]e (?:spelling|times tables|reading|math)[\w\s-]*?|do (?:pages?|exercises?|problems?)[\w\s-]*?|finish (?:the |his |her |their )?(?:project|essay|worksheet|assignment)[\w\s-]*?)(?=\s*(?:,|$|\band\b|\bthen\b))/i
  );
  if (phrase) return capitalise(phrase[1]!.trim().replace(/^(the|his|her|their)\s+/i, ''));

  // "<subject word> worksheet / project / essay" — the noun, with its subject in front.
  const noun = t.match(
    /\b(worksheet|assignment|project|essay|book report|lab report|spelling words|spelling list|flash ?cards|study guide|reading log)\b/i
  );
  if (noun) {
    const n = noun[1]!.toLowerCase().replace('flash cards', 'flashcards');
    if (/^(spelling|book|lab|reading|study)/.test(n)) return capitalise(n);
    return subject ? `${subject} ${n}` : capitalise(n);
  }
  return subject ? `${subject} homework` : 'Homework';
}

/** A due label the task store understands: Today / Tomorrow / a weekday / This week / YYYY-MM-DD. */
function dueOf(text: string, now: Date): string | undefined {
  const t = text.toLowerCase();
  if (/\bthis week\b/.test(t)) return 'This week';
  if (/\bnext week\b/.test(t)) return 'Next week';
  const when = parseWhen(text, now);
  if (!when.date) return /\btonight\b/.test(t) ? 'Today' : undefined;
  const [y, m, d] = when.date.split('-').map(Number);
  const day = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const days = Math.round((day.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (when.dateSource === 'weekday' && days > 1 && days <= 7) {
    return day.toLocaleString('en', { weekday: 'long' });
  }
  return when.date;
}

export function parseHomeworkUtterance(
  text: string,
  memberNames: string[] = [],
  now: Date = new Date()
): HomeworkParse {
  const members = [...memberNames].filter(Boolean).sort((a, b) => b.length - a.length);
  const assignee = members.find((name) => new RegExp(`\\b${escapeRe(name)}('s)?\\b`, 'i').test(text));
  const subject = subjectOf(text);
  return {
    title: titleOf(text, subject, members),
    subject,
    assignee,
    due: dueOf(text, now),
    repeat: repeatOf(text),
    proof: proofOf(text),
  };
}
