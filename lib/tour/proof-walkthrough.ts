/**
 * The proof loop, played out — a scripted demo, not real data.
 *
 *   admin assigns → Sidekick finishes → admin asks for a photo
 *        → photo 1: ✗ not done → admin asks again
 *        → Sidekick does it properly → photo 2: ✓ → admin confirms
 *
 * Nothing here touches the household: no task is created, nothing is saved. It exists so a
 * parent can see the whole round trip once, including the part people miss — that "not done
 * yet" is a normal answer, and you can ask again.
 *
 * The real app runs the same loop with no scripted ending: an admin can keep asking while
 * the 7-day window is open (lib/tasks/verification).
 */

export type WalkthroughKind = 'chore' | 'homework' | 'plan';

/** Who is acting in this beat — the demo swaps "phones" between them. */
export type Actor = 'admin' | 'sidekick';

/** What the mock photo shows. */
export type ShotVerdict = 'messy' | 'clean' | null;

export type WalkthroughBeat = {
  id: string;
  actor: Actor;
  /** Line above the card ("Nero's phone"). */
  stage: string;
  /** What just happened. */
  title: string;
  body: string;
  /** The button that moves it along, in the voice of whoever is acting. */
  cta: string;
  /** Card state to draw: the task row, a photo, or the finished state. */
  show: 'task' | 'task_done' | 'asking' | 'photo' | 'confirmed';
  verdict?: ShotVerdict;
  /** A quiet aside under the card, for the rule being demonstrated. */
  note?: string;
};

const SUBJECT: Record<WalkthroughKind, { title: string; assignLine: string; doneLine: string }> = {
  chore: {
    title: 'Wipe the kitchen counters',
    assignLine: 'You give it to {kid}, due today.',
    doneLine: '{kid} taps Complete. The points land straight away.',
  },
  homework: {
    title: 'Math homework',
    assignLine: 'You give it to {kid}, due today, with a photo when it’s finished.',
    doneLine: '{kid} taps Done. Homework asks for the photo on the way.',
  },
  plan: {
    title: 'Swimming practice',
    assignLine: '{kid} adds it to the calendar.',
    doneLine: 'It waits for you — Sidekick events need a parent to approve.',
  },
};

function fill(text: string, kid: string): string {
  return text.replace(/\{kid\}/g, kid);
}

/** The whole playlet for one kind of work. */
export function walkthroughBeats(kind: WalkthroughKind, kidName: string): WalkthroughBeat[] {
  const kid = kidName.trim() || 'your Sidekick';
  const subject = SUBJECT[kind];

  if (kind === 'plan') {
    return [
      {
        id: 'plan-added',
        actor: 'sidekick',
        stage: `${kid}'s phone`,
        title: subject.title,
        body: fill(subject.assignLine, kid),
        cta: 'Send it to a parent',
        show: 'task',
      },
      {
        id: 'plan-waiting',
        actor: 'admin',
        stage: 'Your phone',
        title: 'Waiting for you',
        body: fill(subject.doneLine, kid),
        cta: 'Approve it',
        show: 'asking',
        note: 'Turn this off in Sidekick permissions and their events go straight on.',
      },
      {
        id: 'plan-done',
        actor: 'admin',
        stage: 'Your phone',
        title: 'On the calendar',
        body: `Everyone sees it now, and ${kid} gets a reminder before it starts.`,
        cta: 'Finish',
        show: 'confirmed',
      },
    ];
  }

  return [
    {
      id: 'assigned',
      actor: 'admin',
      stage: 'Your phone',
      title: subject.title,
      body: fill(subject.assignLine, kid),
      cta: `Give it to ${kid}`,
      show: 'task',
    },
    {
      id: 'completed',
      actor: 'sidekick',
      stage: `${kid}'s phone`,
      title: 'Done!',
      body: fill(subject.doneLine, kid),
      cta: 'Mark it done',
      show: 'task_done',
    },
    {
      id: 'ask',
      actor: 'admin',
      stage: 'Your phone',
      title: 'Ask for a photo',
      body: 'You can ask to see it, any time in the next seven days.',
      cta: 'Ask for a photo',
      show: 'asking',
    },
    {
      id: 'photo-1',
      actor: 'sidekick',
      stage: `${kid}'s phone`,
      title: 'First photo',
      body:
        kind === 'homework'
          ? 'Half the page is blank — this one is not finished.'
          : 'The counters are still covered. This one does not show it done.',
      cta: 'Send the photo',
      show: 'photo',
      verdict: 'messy',
    },
    {
      id: 'reject',
      actor: 'admin',
      stage: 'Your phone',
      title: 'Not done yet',
      body: 'You say so, and ask again. This is the part people miss — you can keep asking.',
      cta: 'Not done — ask again',
      show: 'asking',
      note: 'In the app you can go round this loop as often as you need, for seven days.',
    },
    {
      id: 'photo-2',
      actor: 'sidekick',
      stage: `${kid}'s phone`,
      title: 'Second photo',
      body:
        kind === 'homework'
          ? 'Every question answered this time.'
          : 'Cleared and wiped. That is what done looks like.',
      cta: 'Send the photo',
      show: 'photo',
      verdict: 'clean',
    },
    {
      id: 'confirm',
      actor: 'admin',
      stage: 'Your phone',
      title: 'That is it',
      body: `You confirm, and ${kid} keeps the points.`,
      cta: 'Confirm',
      show: 'confirmed',
    },
  ];
}

/** Progress dots: how far through the playlet a beat sits. */
export function walkthroughProgress(beats: WalkthroughBeat[], index: number): number {
  if (beats.length <= 1) return 1;
  return Math.min(1, Math.max(0, index / (beats.length - 1)));
}

/** The two photos are the point: one refused, one accepted. */
export function photoBeats(beats: WalkthroughBeat[]): WalkthroughBeat[] {
  return beats.filter((beat) => beat.show === 'photo');
}
