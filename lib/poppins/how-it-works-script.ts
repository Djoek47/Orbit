/**
 * "How it works" — a pre-recorded demonstration, not a live session.
 *
 * Two Poppins voices talk to each other and the card on screen does what they say: a task,
 * then a handful of groceries on one card, then three appointments, then a trip with real
 * addresses. Rose asks the way a person would; Indigo does it. They are named after their
 * colours on the voice wheel, so the demo also shows what choosing a colour means.
 *
 * Everything here is data. Nothing is sent anywhere, no model is called and nothing is
 * saved — which is what makes it free to watch as often as you like.
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
  /** The spoken line, written the way it is said. */
  line: string;
  card: DemoCard;
  /** How long this beat sits on screen. */
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

/** The whole recording, in order. */
export const DEMO_BEATS: DemoBeat[] = [
  // ── A chore ────────────────────────────────────────────────────────────────
  {
    id: 'task-ask',
    chapter: 'task',
    speaker: 'rose',
    line: 'Give Nero the bins tonight.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 2000,
    note: 'One sentence. No menus, no form.',
  },
  {
    id: 'task-fill-1',
    chapter: 'task',
    speaker: 'indigo',
    line: 'Bins — Nero.',
    card: { kind: 'task', title: 'Take out the bins', assignee: 'Nero', due: 'Tonight', filled: ['title'] },
    ms: 1100,
  },
  {
    id: 'task-fill-2',
    chapter: 'task',
    speaker: 'indigo',
    line: 'Tonight.',
    card: {
      kind: 'task',
      title: 'Take out the bins',
      assignee: 'Nero',
      due: 'Tonight',
      filled: ['title', 'assignee'],
    },
    ms: 1000,
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
    line: 'Assigned. Nero has it.',
    card: { kind: 'done', label: 'Assigned', detail: 'Take out the bins · Nero · tonight' },
    ms: 1600,
    note: '1 action.',
  },

  // ── The list ───────────────────────────────────────────────────────────────
  {
    id: 'grocery-ask',
    chapter: 'groceries',
    speaker: 'rose',
    line: 'Put milk, eggs, sourdough and coffee on the list.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 2400,
    note: 'Four things in one breath.',
  },
  {
    id: 'grocery-1',
    chapter: 'groceries',
    speaker: 'indigo',
    line: 'Milk, eggs…',
    card: { kind: 'groceries', items: GROCERIES.slice(0, 2) },
    ms: 1100,
  },
  {
    id: 'grocery-2',
    chapter: 'groceries',
    speaker: 'indigo',
    line: '…sourdough, coffee.',
    card: { kind: 'groceries', items: GROCERIES },
    ms: 1400,
    note: 'One card, four items, one confirmation — and the aisles are already right.',
  },
  {
    id: 'grocery-done',
    chapter: 'groceries',
    speaker: 'indigo',
    line: 'Four on the list.',
    card: { kind: 'done', label: 'Added', detail: '4 items · Dairy, Bakery, Pantry' },
    ms: 1600,
    note: '1 action, not four.',
  },

  // ── The week ───────────────────────────────────────────────────────────────
  {
    id: 'calendar-ask',
    chapter: 'calendar',
    speaker: 'rose',
    line: 'Nero has the dentist Tuesday at four, parents’ evening is Thursday half six, and Ama swims Saturday at ten.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 3200,
  },
  {
    id: 'calendar-1',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'Dentist, Tuesday four.',
    card: { kind: 'events', events: EVENTS.slice(0, 1) },
    ms: 1100,
  },
  {
    id: 'calendar-2',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'Thursday, half six.',
    card: { kind: 'events', events: EVENTS.slice(0, 2) },
    ms: 1100,
  },
  {
    id: 'calendar-3',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'And Saturday at ten, Ama.',
    card: { kind: 'events', events: EVENTS },
    ms: 1500,
    note: 'Three appointments from one sentence. Nobody typed a date.',
  },
  {
    id: 'calendar-done',
    chapter: 'calendar',
    speaker: 'indigo',
    line: 'All three are in.',
    card: { kind: 'done', label: 'On the calendar', detail: '3 events this week' },
    ms: 1600,
  },

  // ── A trip ─────────────────────────────────────────────────────────────────
  {
    id: 'trip-ask',
    chapter: 'trip',
    speaker: 'rose',
    line: 'Tuesday I’ll do the dentist, then the pharmacy, then groceries.',
    card: { kind: 'thinking', line: 'Listening…' },
    ms: 2600,
  },
  {
    id: 'trip-1',
    chapter: 'trip',
    speaker: 'indigo',
    line: 'Dentist first — 210 Greenway Road.',
    card: { kind: 'trip', title: 'Tuesday run', stops: STOPS.slice(0, 1) },
    ms: 1400,
    note: 'Saved places come with their address already.',
  },
  {
    id: 'trip-2',
    chapter: 'trip',
    speaker: 'indigo',
    line: 'Pharmacy, 18 Oak Street.',
    card: { kind: 'trip', title: 'Tuesday run', stops: STOPS.slice(0, 2) },
    ms: 1300,
  },
  {
    id: 'trip-3',
    chapter: 'trip',
    speaker: 'rose',
    line: 'The market on Rue Laval.',
    card: { kind: 'trip', title: 'Tuesday run', stops: STOPS },
    ms: 1600,
    note: 'A place it doesn’t know yet? Say the address and it keeps it.',
  },
  {
    id: 'trip-done',
    chapter: 'trip',
    speaker: 'indigo',
    line: 'Three stops, in order, home by half five.',
    card: { kind: 'done', label: 'Trip planned', detail: '3 stops · 3:45 – 5:30 PM' },
    ms: 2200,
    note: 'The grocery list comes along, so you shop once.',
  },
];

export const DEMO_SPEAKERS: Record<DemoSpeaker, { label: string; color: string; role: string }> = {
  // The two ends of the voice wheel, so the demo shows what a colour means.
  rose: { label: 'Rose', color: '#FF6FA5', role: 'asking' },
  indigo: { label: 'Indigo', color: '#7A5BE0', role: 'doing' },
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

/** Which beat is playing at `ms`. Past the end, the last beat holds. */
export function beatAt(ms: number, beats: DemoBeat[] = DEMO_BEATS): number {
  const offsets = demoOffsets(beats);
  let index = 0;
  for (let i = 0; i < beats.length; i += 1) {
    if (ms >= offsets[i]!) index = i;
  }
  return index;
}

/** Where a chapter starts, so its rail button can jump there. */
export function chapterStartMs(chapter: DemoChapterId, beats: DemoBeat[] = DEMO_BEATS): number {
  const offsets = demoOffsets(beats);
  const index = beats.findIndex((beat) => beat.chapter === chapter);
  return index < 0 ? 0 : offsets[index]!;
}

export function chapterOf(index: number, beats: DemoBeat[] = DEMO_BEATS): DemoChapterId {
  return beats[Math.min(beats.length - 1, Math.max(0, index))]!.chapter;
}

/** 0 → 1 through the whole recording. */
export function demoProgress(ms: number, beats: DemoBeat[] = DEMO_BEATS): number {
  const total = demoTotalMs(beats);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, ms / total));
}

/** "1:12" — the runtime, for the caption under the play button. */
export function formatDemoClock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
