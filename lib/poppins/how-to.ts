/**
 * WO12 §D — local how-to index. Teaching never costs an action and never
 * calls the chat model when a pattern matches.
 *
 * Claim (WO): reuse `lib/grocery/fuzzy-match.ts`.
 * Code: fuzzy lives at `lib/poppins/fuzzy-match.ts` (no grocery copy).
 * Did: import from the poppins module that exists.
 */
import type { TourTargetId } from '@/lib/tour/tour-types';
import { bestFuzzyMatch } from '@/lib/poppins/fuzzy-match';

export type HowToStep = {
  text: string;
  route?: string;
  targetId?: TourTargetId;
};

export type HowToEntry = {
  id: string;
  title: string;
  answer: string;
  /** Optional supporting line under the answer (Coach board detail). */
  detail?: string;
  patterns: string[];
  steps: HowToStep[];
  canDoItForYou: boolean;
  /** Optional act to run when "Just do it" is chosen. */
  doItAction?: Record<string, unknown>;
};

export const HOW_TO_INDEX: HowToEntry[] = [
  {
    id: 'proof-on-chore',
    title: 'Proof on a chore',
    answer: 'Three taps, on the chore itself',
    detail:
      'Turn it on per chore, not per person — the photo is asked for when it\'s marked done.',
    patterns: [
      'how do i make a chore need a photo',
      'require proof',
      'photo proof',
      'proof on a chore',
      'need a picture',
    ],
    steps: [
      { text: 'Open Tasks, tap the chore', route: '/(tabs)/tasks', targetId: 'tasks.firstRow' },
      { text: 'Scroll to Proof, switch it on', route: '/(tabs)/tasks', targetId: 'tasks.proof' },
      { text: 'Pick who reviews it — you, or any adult', targetId: 'tasks.proof' },
    ],
    canDoItForYou: true,
  },
  {
    id: 'family-ipad',
    title: 'Family iPad',
    answer: 'Shared devices use profile codes — switch faces on the Home screen.',
    patterns: ['family ipad', 'shared device', 'tablet profile', 'kid device'],
    steps: [
      { text: 'Open Home', route: '/(tabs)' },
      { text: 'Tap the face to switch profiles' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'invite-adult',
    title: 'Invite an adult',
    answer: 'Send an invite from Members — they join with a code or link.',
    patterns: ['invite an adult', 'invite someone', 'add an adult', 'invite member'],
    steps: [
      { text: 'Open Members', route: '/members' },
      { text: 'Tap Invite' },
      { text: 'Share the code' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'house-rules',
    title: 'House rules',
    answer: 'House Rules live under Settings — Poppins reads them before it acts.',
    patterns: ['house rules', 'family rules', 'set rules'],
    steps: [
      { text: 'Open House Rules', route: '/house-rules' },
      { text: 'Add or edit a rule' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'recess',
    title: 'Recess',
    answer: 'Recess is quiet time for kids — open it from the Recess screen.',
    patterns: ['recess', 'quiet time for kids', 'break time'],
    steps: [{ text: 'Open Recess', route: '/recess' }],
    canDoItForYou: false,
  },
  {
    id: 'allowance',
    title: 'Allowance',
    answer: 'Allowance and ranks live on the Ranks tab.',
    patterns: ['allowance', 'pocket money', 'how does allowance work'],
    steps: [{ text: 'Open Ranks', route: '/(tabs)/rewards' }],
    canDoItForYou: false,
  },
  {
    id: 'mint-reward',
    title: 'Mint a reward',
    answer: 'Create a reward in Ranks, then assign it when someone earns it.',
    patterns: ['mint a reward', 'create a reward', 'add a reward'],
    steps: [
      { text: 'Open Ranks', route: '/(tabs)/rewards' },
      { text: 'Add a reward' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'approve-claim',
    title: 'Approve a claim',
    answer: 'When someone claims a reward, approve it from the claim sheet.',
    patterns: ['approve a claim', 'approve reward', 'claim approval'],
    steps: [
      { text: 'Open Ranks', route: '/(tabs)/rewards' },
      { text: 'Review the claim' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'homework',
    title: 'Homework',
    answer: 'Homework chores use the Homework domain and always ask for proof.',
    patterns: ['homework', 'school work', 'assign homework'],
    steps: [
      { text: 'Ask Poppins to assign homework' },
      { text: 'Pick the child and due day' },
    ],
    canDoItForYou: true,
  },
  {
    id: 'groceries-vs-clothing',
    title: 'Groceries vs clothing',
    answer: 'Same list, two lanes — say grocery or shopping/clothing.',
    patterns: ['groceries vs clothing', 'clothing list', 'shopping lane'],
    steps: [
      { text: 'Open Groceries', route: '/(tabs)/groceries' },
      { text: 'Switch lane if needed' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'shopping-mode',
    title: 'Shopping mode',
    answer: 'Shopping mode is the store walkthrough for your list.',
    patterns: ['shopping mode', 'at the store', 'shop the list'],
    steps: [{ text: 'Open Shopping mode', route: '/shopping-mode' }],
    canDoItForYou: false,
  },
  {
    id: 'quiet-hours',
    title: 'Quiet hours',
    answer: 'Quiet hours mute Poppins speech overnight — set them in Poppins settings.',
    patterns: ['quiet hours', 'mute overnight', 'do not disturb poppins'],
    steps: [
      { text: 'Open Poppins settings' },
      { text: 'Set quiet hours' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    answer: 'Notification prefs live in Settings — pick who hears what.',
    patterns: ['notifications', 'alerts', 'push notifications'],
    steps: [{ text: 'Open Settings', route: '/settings' }],
    canDoItForYou: false,
  },
  {
    id: 'act-meter',
    title: 'What an action is',
    answer: 'An action is a committed write — teaching and chat do not count.',
    patterns: [
      'what is an action',
      'what is an act',
      'the meter',
      'act meter',
      'how many actions',
    ],
    steps: [
      { text: 'Open Poppins' },
      { text: 'Check the meter in the header' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'base-vs-max',
    title: 'Base vs Max',
    answer: 'Base is Quiet; Max is Speak back with the model when needed.',
    patterns: ['base vs max', 'quiet vs speak', 'what is max mode', 'what is base'],
    steps: [
      { text: 'Open Poppins' },
      { text: 'Pick Base or Max' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'switch-profiles',
    title: 'Switching profiles',
    answer: 'Tap the face on Home to switch who is using the device.',
    patterns: ['switch profiles', 'change profile', 'switch who'],
    steps: [
      { text: 'Open Home', route: '/(tabs)' },
      { text: 'Tap the active face' },
    ],
    canDoItForYou: false,
  },
  {
    id: 'delete-task',
    title: 'Deleting a task',
    answer: 'Open the task, then delete — or ask Poppins to cancel it.',
    patterns: ['delete a task', 'remove a chore', 'cancel a task'],
    steps: [
      { text: 'Open Tasks', route: '/(tabs)/tasks' },
      { text: 'Open the task and delete' },
    ],
    canDoItForYou: true,
  },
  {
    id: 'recurring-chores',
    title: 'Recurring chores',
    answer: 'Set Repeat to Daily (or the right cadence) when you assign the chore.',
    patterns: ['recurring chores', 'repeat chore', 'daily chore'],
    steps: [
      { text: 'Assign the chore' },
      { text: 'Choose Daily (or another cadence)' },
    ],
    canDoItForYou: true,
  },
  {
    id: 'itineraries',
    title: 'Itineraries',
    answer: 'Say the stops in order — Poppins builds a trip card.',
    patterns: ['itineraries', 'plan a trip', 'multi stop', 'how do trips work'],
    steps: [
      { text: 'Tell Poppins the stops' },
      { text: 'Confirm the trip card' },
    ],
    canDoItForYou: true,
  },
  {
    id: 'saved-places',
    title: 'Saved places',
    answer: 'Save addresses from a trip stop or Places — Poppins reuses them next time.',
    patterns: ['saved places', 'save an address', 'places'],
    steps: [
      { text: 'Open a trip stop' },
      { text: 'Save the address' },
    ],
    canDoItForYou: false,
  },
];

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Local fuzzy match against the how-to index. Null → fall through to the model. */
export function matchHowTo(question: string): HowToEntry | null {
  const q = normalizeQuestion(question);
  if (!q) return null;
  if (!/\b(how|what|where|show me|explain|teach)\b/i.test(question) && q.split(' ').length < 4) {
    // Short non-question utterances are acts, not teaching.
    if (!HOW_TO_INDEX.some((entry) => entry.patterns.some((p) => q.includes(p)))) {
      return null;
    }
  }

  for (const entry of HOW_TO_INDEX) {
    for (const pattern of entry.patterns) {
      if (q.includes(pattern) || pattern.includes(q)) return entry;
    }
  }

  const corpus = HOW_TO_INDEX.flatMap((entry) =>
    entry.patterns.map((pattern) => ({ key: pattern, value: entry }))
  );
  const hit = bestFuzzyMatch(q, corpus);
  if (!hit || hit.distance > 2) return null;
  return hit.value;
}

/** Teaching records weight 0 — never charge the meter. */
export function coachActTokens(): number {
  return 0;
}

/** ui_action that paints the coach_steps card — never a chat reply. */
export function howToUiAction(entry: HowToEntry, utterance: string): Record<string, unknown> {
  return {
    type: 'present_ui_scene',
    scene: 'coach_steps',
    commit: 'none',
    payload: {
      coachLine: entry.answer,
      title: entry.title,
      subtitle: entry.detail ?? entry.answer,
      sourceUtterance: utterance,
      howToId: entry.id,
      canDoItForYou: entry.canDoItForYou,
      coachSteps: entry.steps.map((step, index) => ({
        id: `${entry.id}-${index}`,
        text: step.text,
        route: step.route,
        targetId: step.targetId,
      })),
      write: 'none',
    },
  };
}

/** True when speech during an ad-hoc coach tour means "do it for me". */
export function isCoachDoItSpeech(text: string): boolean {
  return /\b(do it for me|just do it|do it)\b/i.test(text.trim());
}

/** True when speech during an ad-hoc coach tour means stop/exit. */
export function isCoachStopSpeech(text: string): boolean {
  return /^(stop|stop the tour|exit|cancel|never ?mind)\b/i.test(text.trim());
}
