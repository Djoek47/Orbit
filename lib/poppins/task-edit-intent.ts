/**
 * Changes to things that already exist: delete, move to another day, reassign, rename, and
 * "what's on the list". Before this, every one of these created a new task:
 *
 *   "delete the dishes task"   → a task called "Delete the Dishes Task"
 *   "move the dishes to Friday"→ "Move laundry to the dryer", assigned to "Friday"
 *
 * The target is found among the household's open tasks by meaning, not exact words: "the
 * dishes" finds "Wash the dishes", "trash" finds "Take out the garbage", and a name or a day
 * in the sentence narrows it ("Jack's dishes", "tomorrow's trash"). Two close matches → the
 * card asks which one. No match → the card says so and shows what's open.
 *
 * Pure: tasks and the clock come in through the context.
 */
import { formatLocalDate } from '@/lib/streaks/local-date';
import { displayDueLabel, occurrenceDateForDueLabel, resolveOccurrenceDate } from '@/lib/tasks/due-label';
import { levenshtein } from '@/lib/poppins/fuzzy-match';

export type EditableTask = {
  id: string;
  title: string;
  assignee?: string;
  status?: string;
  due?: string;
  dueAt?: string;
  occurrenceDate?: string;
  repeat?: string;
  createdAt?: string;
};

export type EditableEvent = {
  id: string;
  title: string;
  date?: string;
  time?: string;
};

export type EditContext = {
  memberNames: string[];
  selfName?: string;
  tasks: EditableTask[];
  events?: EditableEvent[];
  now?: Date;
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_PHRASE =
  String.raw`(?:today|tonight|tomorrow|this\s+week|next\s+week|this\s+weekend|` +
  String.raw`(?:next\s+|this\s+|on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))`;

/** Words that mean the same chore. */
const SYNONYMS: string[][] = [
  ['dish', 'dishes', 'plates'],
  ['dishwasher'],
  ['trash', 'garbage', 'rubbish', 'bin', 'bins', 'recycling', 'compost'],
  ['laundry', 'clothes', 'washing'],
  ['room', 'bedroom'],
  ['dog', 'puppy', 'pup'],
  ['cat', 'kitty', 'kitten'],
  ['pet', 'pets', 'dog', 'cat', 'fish'],
  ['vacuum', 'hoover', 'vacuuming'],
  ['lawn', 'grass', 'yard', 'mow'],
  ['car', 'auto', 'vehicle'],
  ['tidy', 'clean', 'pick', 'organize'],
  ['homework', 'assignment', 'study'],
  ['bathroom', 'toilet', 'tub', 'shower', 'sink'],
  ['groceries', 'grocery', 'shopping'],
];

const STOP = new Set([
  'the', 'a', 'an', 'my', 'our', 'your', 'his', 'her', 'their', 'this', 'that', 'these', 'those',
  'task', 'tasks', 'chore', 'chores', 'todo', 'to-do', 'job', 'one', 'thing', 'item', 'called',
  'named', 'to', 'for', 'of', 'on', 'in', 'at', 'up', 'out', 'do', 'please', 'and', 'from',
  'list', 'reminder', 'event', 'appointment', 'it', 'last', 'that', 'this',
]);

function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/'s$/, '')
    .replace(/(?:ies)$/, 'y')
    .replace(/(?:es|s)$/, (m, offset, str: string) => (str.length > 4 ? '' : m));
}

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/[^a-z0-9'-]+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

function related(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length > 3 && b.length > 3 && levenshtein(a, b) <= (Math.min(a.length, b.length) > 6 ? 2 : 1)) return true;
  return SYNONYMS.some((group) => {
    const g = group.map(stem);
    return g.includes(a) && g.includes(b);
  });
}

export function isOpen(task: EditableTask): boolean {
  const s = String(task.status ?? '').toLowerCase();
  return s !== 'completed' && s !== 'cancelled' && s !== 'done';
}

export type TaskMatch = { task: EditableTask; score: number };

/**
 * Open tasks that the phrase is about, best first. A person or a day in the sentence narrows
 * the list but never invents a match on its own.
 */
export function findTasks(
  phrase: string,
  ctx: EditContext,
  filters: { assignee?: string; day?: string } = {}
): TaskMatch[] {
  const want = contentWords(phrase);
  const now = ctx.now ?? new Date();
  const dayKey = filters.day ? occurrenceDateForDueLabel(filters.day, now) : undefined;
  const pronoun = !want.length && /\b(?:it|that|this|that\s+one|this\s+one|the\s+last\s+one)\b/i.test(phrase);
  const open = ctx.tasks.filter(isOpen);

  if (pronoun) {
    // "delete it" — the newest open task.
    const newest = [...open].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
    return newest ? [{ task: newest, score: 1 }] : [];
  }
  if (!want.length) return [];

  const scored: TaskMatch[] = [];
  for (const task of open) {
    const have = contentWords(task.title);
    if (!have.length) continue;
    let hits = 0;
    for (const w of want) if (have.some((h) => related(w, h))) hits += 1;
    if (!hits) continue;
    // Share of what was said that the title explains, with a small bonus for a tight title.
    let score = hits / want.length + 0.15 * (hits / have.length);
    if (filters.assignee && task.assignee?.toLowerCase().includes(filters.assignee.toLowerCase())) score += 0.3;
    else if (filters.assignee) score -= 0.4;
    if (dayKey) {
      const taskDay = resolveOccurrenceDate(task as never, now);
      if (taskDay === dayKey) score += 0.25;
      else if (taskDay) score -= 0.2;
    }
    if (score >= 0.5) scored.push({ task, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** One clear winner, or the close ones to choose between. */
export function pickTarget(matches: TaskMatch[]): { task?: EditableTask; choices: EditableTask[] } {
  if (!matches.length) return { choices: [] };
  const [first, second] = matches;
  if (!second || first!.score - second.score >= 0.2) return { task: first!.task, choices: [] };
  return { choices: matches.filter((m) => first!.score - m.score < 0.2).slice(0, 4).map((m) => m.task) };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function memberIn(text: string, ctx: EditContext): string | undefined {
  // "show me", "tell me", "give me" are about who's asking, not whose tasks.
  text = text.replace(/\b(?:show|tell|give|list|let)\s+me\b/gi, ' ');
  for (const name of ctx.memberNames) {
    if (new RegExp(String.raw`\b${escapeRegExp(name)}(?:'s)?\b`, 'i').test(text)) return name;
  }
  if (/\b(?:me|myself|mine|my)\b/i.test(text) && ctx.selfName) return ctx.selfName;
  return undefined;
}

function dayIn(text: string): string | undefined {
  const m = text.match(new RegExp(DAY_PHRASE, 'i'));
  if (!m) return undefined;
  const raw = m[0].toLowerCase().replace(/^(?:on|this)\s+/, '').trim();
  if (raw === 'tonight') return 'Today';
  if (/^next\s+(\w+day)$/.test(raw)) return raw.replace(/^next\s+/, 'next ');
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The task phrase with the person, the day and possessives taken out. */
function targetPhrase(text: string, ctx: EditContext): string {
  let s = ` ${text} `;
  for (const name of ctx.memberNames) {
    s = s.replace(new RegExp(String.raw`\b(?:for|from|of|to)\s+${escapeRegExp(name)}\b`, 'gi'), ' ');
    s = s.replace(new RegExp(String.raw`\b${escapeRegExp(name)}(?:'s)?\b`, 'gi'), ' ');
  }
  s = s.replace(/\b(?:for|from)\s+(?:me|myself)\b/gi, ' ');
  s = s.replace(new RegExp(String.raw`\b(?:from\s+|for\s+|on\s+)?${DAY_PHRASE}(?:'s)?\b`, 'gi'), ' ');
  s = s.replace(/\b(?:from|off|on|in)\s+(?:the\s+|my\s+|our\s+)?(?:list|calendar|tasks?)\b/gi, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function labelFor(task: EditableTask, now: Date): string {
  return displayDueLabel(task as never, now) || task.due || '';
}

function row(task: EditableTask, now: Date) {
  const day = labelFor(task, now);
  return {
    id: task.id,
    title: task.title,
    detail: [task.assignee, day].filter(Boolean).join(' · ') || undefined,
  };
}

export type EditKind = 'delete' | 'move' | 'reassign' | 'rename';

function changeAction(
  kind: EditKind,
  phrase: string,
  ctx: EditContext,
  filters: { assignee?: string; day?: string },
  patch: { due?: string; assignee?: string; title?: string },
  utterance: string
): Record<string, unknown> {
  const now = ctx.now ?? new Date();
  const { task, choices } = pickTarget(findTasks(phrase, ctx, filters));
  const base = { type: 'change_task', change: kind, patch, sourceUtterance: utterance, query: phrase };
  if (task) {
    return {
      ...base,
      taskId: task.id,
      title: task.title,
      assignee: task.assignee,
      dueLabel: labelFor(task, now),
      repeat: task.repeat,
    };
  }
  if (choices.length) {
    return { ...base, choices: choices.map((t) => row(t, now)) };
  }
  return {
    ...base,
    notFound: true,
    choices: ctx.tasks.filter(isOpen).slice(0, 4).map((t) => row(t, now)),
  };
}

const DELETE_RE =
  /^(?:delete|remove|cancel|erase|drop|scrap|get\s+rid\s+of|take\s+off|take\s+away|clear|forget(?:\s+about)?)\s+(.+)$/i;
const MOVE_RE = new RegExp(
  String.raw`^(?:move|reschedule|push|shift|postpone|change|switch|bump|put|make)\s+(.+?)\s+(?:to|until|till|for|on|back\s+to)\s+(${DAY_PHRASE})(?:\s+instead)?$`,
  'i'
);
const POSTPONE_RE = /^(?:postpone|push(?:\s+back)?|delay|snooze)\s+(.+?)(?:\s+(?:by\s+a\s+day|a\s+day|one\s+day))?$/i;

/**
 * A change to something that exists, or null when the sentence isn't one. Runs on the
 * prepared sentence (request wrappers already removed).
 */
export function parseTaskEditIntent(text: string, ctx: EditContext): Record<string, unknown> | null {
  const s = text.replace(/[’`]/g, "'").replace(/[.!]+$/, '').trim();
  if (!s) return null;

  // Groceries have their own list — "remove milk from the list" is not a task.
  if (/\b(?:grocer|shopping)\w*\b/i.test(s) || /\bfrom\s+(?:the|my|our)\s+list\b/i.test(s)) return null;

  // ── Rename ───────────────────────────────────────────────────────────────────────────
  const rename = s.match(/^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i) ?? s.match(/^(?:change|switch)\s+(?:the\s+)?(?:name|title)\s+of\s+(.+?)\s+to\s+(.+)$/i);
  if (rename) {
    const newTitle = rename[2]!.replace(/^["']|["']$/g, '').trim();
    if (newTitle) {
      return changeAction('rename', targetPhrase(rename[1]!, ctx), ctx, {}, { title: newTitle.charAt(0).toUpperCase() + newTitle.slice(1) }, s);
    }
  }

  // ── Reassign ─────────────────────────────────────────────────────────────────────────
  const names = ctx.memberNames.map(escapeRegExp);
  if (names.length) {
    const who = `(${names.join('|')}|me)`;
    const patterns: Array<[RegExp, number, number]> = [
      [new RegExp(String.raw`^(?:reassign|give|hand|pass|transfer|switch|move|change)\s+(.+?)\s+(?:over\s+)?to\s+${who}(?:\s+instead)?$`, 'i'), 1, 2],
      [new RegExp(String.raw`^${who}\s+(?:should|will|can|could|is\s+going\s+to)\s+(?:do|take|handle)\s+(.+?)\s+instead$`, 'i'), 2, 1],
      [new RegExp(String.raw`^(?:let|have|make)\s+${who}\s+(?:do|take|handle)\s+(.+?)(?:\s+instead)?$`, 'i'), 2, 1],
      [new RegExp(String.raw`^make\s+(.+?)\s+${who}'s(?:\s+instead)?$`, 'i'), 1, 2],
    ];
    for (const [re, taskIdx, whoIdx] of patterns) {
      const m = s.match(re);
      if (!m) continue;
      const rawWho = m[whoIdx]!;
      const assignee = /^me$/i.test(rawWho) ? ctx.selfName ?? rawWho : ctx.memberNames.find((n) => n.toLowerCase() === rawWho.toLowerCase()) ?? rawWho;
      const taskText = m[taskIdx]!;
      // "give the dishes to Mia" with no matching task is a new task, not a reassignment.
      const phrase = targetPhrase(taskText, ctx);
      const filters = { day: dayIn(taskText) };
      if (!findTasks(phrase, ctx, filters).length && /^(?:give|hand|let|have|make)\b/i.test(s)) return null;
      return changeAction('reassign', phrase, ctx, filters, { assignee }, s);
    }
  }

  // ── Move to another day ──────────────────────────────────────────────────────────────
  const move = s.match(MOVE_RE);
  if (move) {
    const taskText = move[1]!;
    const toDay = dayIn(move[2]!)!;
    const fromAssignee = memberIn(taskText, ctx);
    const phrase = targetPhrase(taskText, ctx);
    const filters = { assignee: fromAssignee, day: dayIn(taskText) };
    // "put soccer on Friday" with nothing to move is a new event/task, not a move.
    if (!findTasks(phrase, ctx, filters).length && /^(?:put|make|change|switch)\b/i.test(s)) return null;
    return changeAction('move', phrase, ctx, filters, { due: toDay }, s);
  }
  const postpone = s.match(POSTPONE_RE);
  if (postpone && !new RegExp(DAY_PHRASE, 'i').test(postpone[1]!)) {
    const taskText = postpone[1]!;
    return changeAction('move', targetPhrase(taskText, ctx), ctx, { assignee: memberIn(taskText, ctx) }, { due: 'Tomorrow' }, s);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────────────
  const del = s.match(DELETE_RE);
  if (del) {
    const taskText = del[1]!;
    // "clear the list" belongs to groceries; "cancel the dentist" may be an event (below).
    if (/^(?:the\s+)?(?:list|grocer)/i.test(taskText)) return null;
    const phrase = targetPhrase(taskText, ctx);
    const filters = { assignee: memberIn(taskText, ctx), day: dayIn(taskText) };
    const event = matchEvent(phrase, ctx);
    const taskMatches = findTasks(phrase, ctx, filters);
    if (event && (!taskMatches.length || /\b(?:appointment|event|meeting|calendar)\b/i.test(taskText))) {
      return {
        type: 'change_event',
        change: 'delete',
        eventId: event.id,
        title: event.title,
        dueLabel: event.date ? eventDayLabel(event, ctx.now ?? new Date()) : undefined,
        sourceUtterance: s,
      };
    }
    return changeAction('delete', phrase, ctx, filters, {}, s);
  }

  return null;
}

function matchEvent(phrase: string, ctx: EditContext): EditableEvent | undefined {
  const want = contentWords(phrase);
  if (!want.length || !ctx.events?.length) return undefined;
  const today = formatLocalDate(ctx.now ?? new Date());
  const upcoming = ctx.events.filter((e) => !e.date || e.date >= today);
  let best: { event: EditableEvent; score: number } | undefined;
  for (const event of upcoming) {
    const have = contentWords(event.title);
    const hits = want.filter((w) => have.some((h) => related(w, h))).length;
    const score = hits / want.length;
    if (score >= 0.6 && (!best || score > best.score)) best = { event, score };
  }
  return best?.event;
}

function eventDayLabel(event: EditableEvent, now: Date): string {
  if (!event.date) return '';
  const [y, m, d] = event.date.split('-').map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = formatLocalDate(now);
  if (event.date === today) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (event.date === formatLocalDate(tomorrow)) return 'Tomorrow';
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── "What's on the list" ──────────────────────────────────────────────────────────────────

const LIST_RE = [
  /^(?:what|which)\s+(?:tasks?|chores?|things?|jobs?)\b/i,
  /^what(?:'s|\s+is|\s+are)\s+(?:on|left\s+on)\s+(?:the\s+|my\s+|our\s+|\w+'s\s+)?(?:list|plate|agenda|to-?do)/i,
  /^what\s+(?:does|do|did)\s+\w+\s+(?:have|need\s+to\s+do|got)\b/i,
  /^what(?:'s|\s+is)\s+\w+\s+(?:doing|got)\b/i,
  /^(?:show|list|tell)\s+(?:me\s+)?(?:all\s+)?(?:the\s+|my\s+|our\s+|\w+'s\s+)?(?:open\s+)?(?:tasks?|chores?|to-?dos?)\b/i,
  /^(?:what\s+do\s+i\s+have|what(?:'s|\s+is)\s+left|what\s+needs\s+(?:to\s+be\s+)?doing)\b/i,
];

/** "What does Jack have tomorrow?" → the matching open tasks, as a list on screen. */
export function parseTaskListIntent(text: string, ctx: EditContext): Record<string, unknown> | null {
  const s = text.replace(/[’`]/g, "'").replace(/[?.!]+$/, '').trim();
  if (!LIST_RE.some((re) => re.test(s))) return null;
  if (/\bovere?due\b/i.test(s)) return null; // the overdue reader owns that one
  const now = ctx.now ?? new Date();
  const who = memberIn(s.replace(/^what\s+do\s+i\b/i, 'what does me'), ctx);
  const day = dayIn(s);
  const dayKey = day ? occurrenceDateForDueLabel(day, now) : undefined;
  const rows = ctx.tasks
    .filter(isOpen)
    .filter((t) => !who || t.assignee?.toLowerCase().includes(who.toLowerCase()))
    .filter((t) => !dayKey || resolveOccurrenceDate(t as never, now) === dayKey)
    .slice(0, 8)
    .map((t) => row(t, now));
  const whoLabel = who ? (who === ctx.selfName ? 'You' : who) : 'Everyone';
  const dayLabel = day ? ` · ${day}` : '';
  return {
    type: 'list_tasks',
    rows: rows.map((r) => ({ id: r.id, title: r.title, assignee: r.detail })),
    title: `${whoLabel}${dayLabel}`,
    thinkingLine: rows.length ? `${rows.length} open` : 'Nothing open',
    sourceUtterance: s,
  };
}

/** The YYYY-MM-DD a spoken day lands on (exported for commit). */
export function dayKeyFor(label: string, now = new Date()): string {
  if (WEEKDAYS.includes(label.toLowerCase())) return occurrenceDateForDueLabel(label, now);
  return occurrenceDateForDueLabel(label, now);
}
