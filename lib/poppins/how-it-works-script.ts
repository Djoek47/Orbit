/**
 * "How it works" — a pre-recorded demonstration, not a live session.
 *
 * Two voices talk like a real chat: Rose is the person asking, Indigo is Poppins
 * answering. Cards on screen do what they say. Audio is baked once with GPT voice
 * (see scripts/generate-how-it-works-audio.mjs) and shipped under assets/how-it-works.
 */

export type DemoSpeaker = 'rose' | 'indigo';

/** The card shapes the demo draws. A small subset of the real scene graph. */
export type DemoCard =
  | { kind: 'idle' }
  | { kind: 'thinking'; line: string }
  | {
      kind: 'task';
      title: string;
      assignee: string;
      due: string;
      /** Slots fill one at a time — these are the ones filled so far. */
      filled: ('title' | 'assignee' | 'due')[];
    }
  | { kind: 'groceries'; items: { label: string; aisle: string }[] }
  | { kind: 'events'; events: { title: string; when: string; who?: string }[] }
  | {
      kind: 'trip';
      title: string;
      stops: { label: string; address: string; time: string }[];
    }
  | { kind: 'done'; label: string; detail?: string };

export type DemoBeat = {
  id: string;
  /** Which chapter this beat belongs to, for the chapter rail. */
  chapter: DemoChapterId;
  /** Who is speaking, or null for a beat where the card moves on its own. */
  speaker: DemoSpeaker | null;
  /** The spoken line, written the way a person would actually say it. */
  line: string;
  card: DemoCard;
  /** How long this beat sits on screen — must cover the recorded clip. */
  ms: number;
  /** A quiet aside under the card — the thing the beat is teaching. */
  note?: string;
};

export type DemoChapterId = 'task' | 'groceries' | 'calendar' | 'trip';

export const DEMO_CHAPTERS: { id: DemoChapterId; label: string; moji: string; color: string }[] = [
  { id: 'task', label: 'A chore', moji: 'clipboard', color: '#4FA3FF' },
  { id: 'groceries', label: 'The list', moji: 'cart', color: '#7FC24A' },
  { id: 'calendar', label: 'The week', moji: 'calendar', color: '#FF9F1C' },
  { id: 'trip', label: 'A trip', moji: 'pin', color: '#17B9A0' },
];

const GROCERIES = [
  { label: 'Milk', aisle: 'Dairy' },
  { label: 'Eggs', aisle: 'Dairy' },
  { label: 'Sourdough', aisle: 'Bakery' },
  { label: 'Coffee', aisle: 'Pantry' },
];

const EVENTS = [
  { title: 'Dentist', when: 'Tue 4:00 PM', who: 'Nero' },
  { title: 'Parents’ evening', when: 'Thu 6:30 PM' },
  { title: 'Swimming', when: 'Sat 10:00 AM', who: 'Ama' },
];

const STOPS = [
  { label: 'Dentist', address: '210 Greenway Rd', time: '3:45 PM' },
  { label: 'Pharmacy', address: '18 Oak St', time: '4:30 PM' },
  { label: 'Groceries', address: 'Marché Ouest, 44 Rue Laval', time: '5:00 PM' },
];

/**
 * Natural conversation — Rose asks like a parent, Indigo answers like Poppins.
 * Lines are full spoken English with punctuation so GPT voice can sound human.
 */
export const DEMO_BEATS: DemoBeat[] = [
  // ── A chore ────────────────────────────────────────────────────────────────
  {
    id: 'task-ask',
    chapter: 'task',
    speaker: 'rose',
    line: 'Hey Poppins — can you give Nero the bins tonight?',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 2800,
    note: 'One sentence. No menus, no form.',
  },
  {
    id: 'task-fill-1',
    chapter: 'task',
    speaker: 'indigo',
    line: 'Got it. Taking out the bins, for Nero.',
    card: { kind: 'task', title: 'Take out the bins', assignee: 'Nero', due: 'Tonight', filled: ['title'] },
    ms: 2400,
  },
  {
    id: 'task-fill-2',
    chapter: 'task',
    speaker: 'indigo',
    line: 'Due tonight.',
    card: {
      kind: 'task',
      title: 'Take out the bins',
      assignee: 'Nero',
      due: 'Tonight',
      filled: ['title', 'assignee'],
    },
    ms: 1400,
    note: 'It fills in as you speak — who, what, when.',
  },
  {
    id: 'task-ready',
    chapter: 'task',
    speaker: null,
    line: 'Holding, so you can change it.',
    card: {
      kind: 'task',
      title: 'Take out the bins',
      assignee: 'Nero',
      due: 'Tonight',
      filled: ['title', 'assignee', 'due'],
    },
    ms: 1500,
    note: 'Say something else and the card changes. Say nothing and it saves.',
  },
  {
    id: 'task-done',
    chapter: 'task',
    speaker: 'indigo',
    line: 'Assigned. Nero has it for tonight.',
    card: { kind: 'done', label: 'Assigned', detail: 'Take out the bins · Nero · tonight' },
    ms: 2400,
    note: '1 action.',
  },

  // ── The list ───────────────────────────────────────────────────────────────
  {
    id: 'grocery-ask',
    chapter: 'groceries',
    speaker: 'rose',
    line: 'Add milk, eggs, sourdough, and coffee to the list, please.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 3200,
    note: 'Four things in one breath.',
  },
  {
    id: 'grocery-1',
    chapter: 'groceries',
    speaker: 'indigo',
    line: 'Milk and eggs…',
    card: { kind: 'groceries', items: GROCERIES.slice(0, 2) },
    ms: 1600,
  },
  {
    id: 'grocery-2',
    chapter: 'groceries',
    speaker: 'indigo',
    line: '…sourdough and coffee.',
    card: { kind: 'groceries', items: GROCERIES },
    ms: 1800,
    note: 'One card, four items, one confirmation — and the aisles are already right.',
  },
  {
    id: 'grocery-done',
    chapter: 'groceries',
    speaker: 'indigo',
    line: 'That’s four on the list.',
    card: { kind: 'done', label: 'Added', detail: '4 items · Dairy, Bakery, Pantry' },
    ms: 2000,
    note: '1 action, not four.',
  },

  // ── The week ───────────────────────────────────────────────────────────────
  {
    id: 'calendar-ask',
    chapter: 'calendar',
    speaker: 'rose',
    line: 'Nero has the dentist Tuesday at four. Parents’ evening is Thursday at half past six, and Ama swims Saturday at ten.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 5200,
  },
  {
    id: 'calendar-1',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'Dentist for Nero — Tuesday at four.',
    card: { kind: 'events', events: EVENTS.slice(0, 1) },
    ms: 2200,
  },
  {
    id: 'calendar-2',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'Parents’ evening, Thursday at half past six.',
    card: { kind: 'events', events: EVENTS.slice(0, 2) },
    ms: 2600,
  },
  {
    id: 'calendar-3',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'And Ama’s swimming on Saturday at ten.',
    card: { kind: 'events', events: EVENTS },
    ms: 2400,
    note: 'Three appointments from one sentence. Nobody typed a date.',
  },
  {
    id: 'calendar-done',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'All three are on the calendar.',
    card: { kind: 'done', label: 'On the calendar', detail: '3 events this week' },
    ms: 2200,
  },

  // ── A trip ─────────────────────────────────────────────────────────────────
  {
    id: 'trip-ask',
    chapter: 'trip',
    speaker: 'rose',
    line: 'On Tuesday I’ll do the dentist, then the pharmacy, then groceries.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 3400,
  },
  {
    id: 'trip-1',
    chapter: 'trip',
    speaker: 'indigo',
    line: 'Dentist first — two-ten Greenway Road.',
    card: { kind: 'trip', title: 'Tuesday run', stops: STOPS.slice(0, 1) },
    ms: 2400,
    note: 'Saved places come with their address already.',
  },
  {
    id: 'trip-2',
    chapter: 'trip',
    speaker: 'indigo',
    line: 'Then the pharmacy on eighteen Oak Street.',
    card: { kind: 'trip', title: 'Tuesday run', stops: STOPS.slice(0, 2) },
    ms: 2400,
  },
  {
    id: 'trip-3',
    chapter: 'trip',
    speaker: 'rose',
    line: 'And the market on Rue Laval after that.',
    card: { kind: 'trip', title: 'Tuesday run', stops: STOPS },
    ms: 2400,
    note: 'A place it doesn’t know yet? Say the address and it keeps it.',
  },
  {
    id: 'trip-done',
    chapter: 'trip',
    speaker: 'indigo',
    line: 'Three stops, in order. You’ll be home by about half past five.',
    card: { kind: 'done', label: 'Trip planned', detail: '3 stops · 3:45 – 5:30 PM' },
    ms: 3600,
    note: 'The grocery list comes along, so you shop once.',
  },
];

export const DEMO_SPEAKERS: Record<DemoSpeaker, { label: string; color: string; role: string }> = {
  // Voice-wheel colours: Rose asks like you; Indigo answers as Poppins.
  rose: { label: 'You', color: '#FF6FA5', role: 'asking' },
  indigo: { label: 'Poppins', color: '#7A5BE0', role: 'doing' },
};

export function demoTotalMs(beats: DemoBeat[] = DEMO_BEATS): number {
  return beats.reduce((sum, beat) => sum + beat.ms, 0);
}

/** Milliseconds from the start to the beginning of each beat. */
export function demoOffsets(beats: DemoBeat[] = DEMO_BEATS): number[] {
  let running = 0;
  return beats.map((beat) => {
    const start = running;
    running += beat.ms;
    return start;
  });
}

export function beatAt(ms: number, beats: DemoBeat[] = DEMO_BEATS): number {
  if (ms <= 0) return 0;
  const offsets = demoOffsets(beats);
  for (let i = offsets.length - 1; i >= 0; i -= 1) {
    if (ms >= offsets[i]!) return i;
  }
  return 0;
}

export function chapterOf(index: number, beats: DemoBeat[] = DEMO_BEATS): DemoChapterId {
  const safe = Math.max(0, Math.min(beats.length - 1, index));
  return beats[safe]!.chapter;
}

export function chapterStartMs(chapter: DemoChapterId, beats: DemoBeat[] = DEMO_BEATS): number {
  const offsets = demoOffsets(beats);
  const index = beats.findIndex((beat) => beat.chapter === chapter);
  return index >= 0 ? offsets[index]! : 0;
}

export function demoProgress(ms: number, beats: DemoBeat[] = DEMO_BEATS): number {
  const total = demoTotalMs(beats);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, ms / total));
}

export function formatDemoClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
