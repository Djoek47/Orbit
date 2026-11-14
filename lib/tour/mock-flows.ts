/**
 * The tour's mock windows.
 *
 * The tour used to drive the real screens: it opened the real Assign sheet, seeded it, and
 * waited for a real task to be created. Two screens ended up on top of each other — "like two
 * apps running" — and the homework version glitched the same way. Nothing here touches the app:
 * each flow is a short script, drawn inside a fake window that is labelled as one, so it can't
 * stack over anything or leave a half-made task behind.
 *
 * Three flows:
 *   assign     — give a chore to a Sidekick
 *   homework   — the same, with a subject and a photo
 *   sidekick   — add a Sidekick: a phone held over the QR code on this one
 */

export type MockFlowId = 'assign' | 'homework' | 'sidekick';

/** What the fake window draws. */
export type MockScreen =
  | {
      kind: 'form';
      /** The window's own title bar. */
      window: string;
      rows: { label: string; value: string; filled: boolean; hint?: string }[];
      /** The button at the bottom of the fake window. */
      button: string;
      /** Button is live-looking only once the form is full. */
      buttonReady: boolean;
    }
  | { kind: 'list'; window: string; rows: { title: string; detail?: string; done?: boolean }[] }
  | { kind: 'qr'; window: string; code: string; phoneLabel: string; scanned: boolean }
  | { kind: 'joined'; window: string; name: string; detail: string };

export type MockStep = {
  id: string;
  /** Whose screen this is ("Your phone", "Nero's phone"). */
  stage: string;
  /** Sidekick screens get their own tint. */
  side: 'admin' | 'sidekick';
  title: string;
  body: string;
  /** The button under the words that moves the demo along. */
  cta: string;
  screen: MockScreen;
  note?: string;
};

export const MOCK_FLOW_TITLE: Record<MockFlowId, string> = {
  assign: 'Giving out a chore',
  homework: 'Giving out homework',
  sidekick: 'Adding a Sidekick',
};

function fill(text: string, kid: string): string {
  return text.replace(/\{kid\}/g, kid);
}

/** A form with the first `filled` rows completed. */
function form(
  window: string,
  rows: { label: string; value: string; hint?: string }[],
  filled: number,
  button: string
): MockScreen {
  return {
    kind: 'form',
    window,
    rows: rows.map((row, index) => ({ ...row, filled: index < filled })),
    button,
    buttonReady: filled >= rows.length,
  };
}

function assignSteps(kid: string): MockStep[] {
  const rows = [
    { label: 'Chore', value: 'Take out the bins', hint: 'from your list, or type your own' },
    { label: 'Who', value: kid, hint: 'anyone in the house' },
    { label: 'When', value: 'Today', hint: 'today, a day, or every week' },
  ];
  return [
    {
      id: 'assign.open',
      stage: 'Your phone',
      side: 'admin',
      title: 'Three things, in order',
      body: 'A chore needs what, who, and when. Nothing else.',
      cta: 'Pick a chore',
      screen: form('Assign a chore', rows, 0, 'Assign'),
    },
    {
      id: 'assign.what',
      stage: 'Your phone',
      side: 'admin',
      title: 'What',
      body: 'Pick from your list, or type your own. Points are set for you.',
      cta: `Give it to ${kid}`,
      screen: form('Assign a chore', rows, 1, 'Assign'),
    },
    {
      id: 'assign.who',
      stage: 'Your phone',
      side: 'admin',
      title: 'Who',
      body: 'One person, or split it between two. They see it straight away.',
      cta: 'Say when',
      screen: form('Assign a chore', rows, 2, 'Assign'),
      note: 'Split a chore and the points split too.',
    },
    {
      id: 'assign.when',
      stage: 'Your phone',
      side: 'admin',
      title: 'When',
      body: 'Today, a day this week, or every week. Then Assign.',
      cta: 'Assign it',
      screen: form('Assign a chore', rows, 3, 'Assign'),
    },
    {
      id: 'assign.landed',
      stage: `${kid}'s phone`,
      side: 'sidekick',
      title: 'It arrives',
      body: `${kid} gets it with the points on it, and taps it off when it's done.`,
      cta: 'Got it',
      screen: {
        kind: 'list',
        window: 'Today',
        rows: [
          { title: 'Take out the bins', detail: 'Today · 10 points' },
          { title: 'Make your bed', detail: 'Today · 5 points', done: true },
        ],
      },
      note: 'That is the whole loop. Real ones work exactly like this.',
    },
  ];
}

function homeworkSteps(kid: string): MockStep[] {
  const rows = [
    { label: 'Subject', value: 'Maths', hint: 'maths, reading, French…' },
    { label: 'What', value: 'Exercises 4 to 9', hint: 'as much or as little as you like' },
    { label: 'Who', value: kid, hint: 'homework goes to one child' },
    { label: 'When', value: 'Tomorrow', hint: 'when it is due in' },
    { label: 'Photo', value: 'Asked for', hint: 'a photo when they mark it done' },
  ];
  return [
    {
      id: 'homework.open',
      stage: 'Your phone',
      side: 'admin',
      title: 'Homework is its own thing',
      body: 'Same idea as a chore, with a subject — and reading time is tracked.',
      cta: 'Pick a subject',
      screen: form('Assign homework', rows, 0, 'Assign'),
    },
    {
      id: 'homework.subject',
      stage: 'Your phone',
      side: 'admin',
      title: 'Subject, then what',
      body: 'The subject builds the week: how much maths, how much reading.',
      cta: 'Say what',
      screen: form('Assign homework', rows, 1, 'Assign'),
    },
    {
      id: 'homework.what',
      stage: 'Your phone',
      side: 'admin',
      title: 'What to do',
      body: 'A page, a chapter, twenty minutes — whatever you would have said out loud.',
      cta: `Give it to ${kid}`,
      screen: form('Assign homework', rows, 2, 'Assign'),
    },
    {
      id: 'homework.who',
      stage: 'Your phone',
      side: 'admin',
      title: 'Who and when',
      body: 'One child. Homework needs a Sidekick — an adult can’t be given homework.',
      cta: 'Ask for a photo',
      screen: form('Assign homework', rows, 4, 'Assign'),
    },
    {
      id: 'homework.proof',
      stage: 'Your phone',
      side: 'admin',
      title: 'A photo when it is done',
      body: 'A photo is asked for by default, per child. No photo, no tick.',
      cta: 'Assign it',
      screen: form('Assign homework', rows, 5, 'Assign'),
    },
    {
      id: 'homework.landed',
      stage: `${kid}'s phone`,
      side: 'sidekick',
      title: 'It arrives',
      body: `${kid} sees the subject and what is due. Done opens the camera.`,
      cta: 'Got it',
      screen: {
        kind: 'list',
        window: 'Homework',
        rows: [
          { title: 'Maths · Exercises 4 to 9', detail: 'Due tomorrow · photo' },
          { title: 'Reading · 20 minutes', detail: 'Today', done: true },
        ],
      },
      note: 'Only the child it is given to sees Done.',
    },
  ];
}

function sidekickSteps(): MockStep[] {
  return [
    {
      id: 'sidekick.code',
      stage: 'Your phone',
      side: 'admin',
      title: 'A code on your screen',
      body: 'Settings, then Add someone. A code appears, good for one join.',
      cta: 'Hold up their phone',
      screen: { kind: 'qr', window: 'Add someone', code: 'HOUSE-4821', phoneLabel: 'Their phone', scanned: false },
    },
    {
      id: 'sidekick.scan',
      stage: 'Their phone',
      side: 'sidekick',
      title: 'They point their camera at it',
      body: 'No email, no password to invent. The code is the whole thing.',
      cta: 'They are in',
      screen: { kind: 'qr', window: 'Add someone', code: 'HOUSE-4821', phoneLabel: 'Their phone', scanned: true },
      note: 'No phone of their own? A shared iPad works the same way.',
    },
    {
      id: 'sidekick.joined',
      stage: 'Your phone',
      side: 'admin',
      title: 'Now you can give them things',
      body: 'Chores, homework, points and rewards. You choose what they can do.',
      cta: 'Done',
      screen: {
        kind: 'joined',
        window: 'The house',
        name: 'Nero',
        detail: 'Sidekick · joined just now',
      },
      note: 'What a Sidekick is allowed to do lives in Sidekick permissions.',
    },
  ];
}

/** The script for one flow. `kidName` is only used where a name reads better than "them". */
export function mockFlowSteps(flow: MockFlowId, kidName?: string): MockStep[] {
  const kid = kidName?.trim() || 'Nero';
  const steps =
    flow === 'assign' ? assignSteps(kid) : flow === 'homework' ? homeworkSteps(kid) : sidekickSteps();
  return steps.map((step) => ({
    ...step,
    stage: fill(step.stage, kid),
    body: fill(step.body, kid),
    cta: fill(step.cta, kid),
  }));
}

export function isMockFlowId(value: unknown): value is MockFlowId {
  return value === 'assign' || value === 'homework' || value === 'sidekick';
}

/** 0 → 1 through a flow, so the bar is full on the last step. */
export function mockFlowProgress(steps: MockStep[], index: number): number {
  if (steps.length <= 1) return 1;
  return Math.min(1, Math.max(0, (index + 1) / steps.length));
}
