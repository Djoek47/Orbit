import { displayTrophyName } from '@/lib/trophies/display-name';

/**
 * Closed notification registry — Revision E §2.
 *
 * Copy rules (do not reintroduce these faults):
 * - Name the person; never "A user" / "Someone"
 * - State what happened, then stop — never advise how to feel or decide
 * - Sentence case in the body; lower-case interpolated data mid-sentence
 * - Under 12 words in the body when possible
 * - Plain full stops; zero exclamation marks; zero emoji
 * - Household-local 12-hour times with AM/PM
 * - Never internal vocabulary (mint, origin, ledger, occurrence)
 *
 * THIS LIST IS CLOSED. Unlisted notifications must be deleted, not kept.
 * Spec: docs/logic/choremaxx-revision-e-spec.md §2
 */

export type NotificationId =
  | 'N01'
  | 'N02'
  | 'N03'
  | 'N04'
  | 'N05'
  | 'N06'
  | 'N07'
  | 'N08'
  | 'N09'
  | 'N10'
  | 'N11'
  | 'N12'
  | 'N13'
  | 'N14'
  | 'N15'
  | 'N16'
  | 'N17'
  | 'N18'
  | 'N19'
  | 'N20'
  | 'N21'
  | 'N22'
  | 'N23'
  | 'N24'
  | 'N25'
  | 'N26'
  | 'N27'
  | 'N28';

export type NotificationAudience = 'helper' | 'admin';

export type NotificationDef = {
  id: NotificationId;
  audience: NotificationAudience;
  /** Static title segment after "Poppins" / "Poppins · …". */
  title: string;
  /**
   * Body template. Placeholders: {name}, {task}, {reward}, {count}, {xp},
   * {streak}, {time}, {amount}, {trophy}, {admin}, {detail}
   * Route interpolated values through toSentenceValue().
   */
  body: string;
};

/** Lower-case a data value that lands mid-sentence (not people's names). */
export function toSentenceValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function formatNotificationBody(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const raw = vars[key];
    if (raw == null) return '';
    const str = String(raw);
    // People's names and leading sentence starts stay as provided.
    if (key === 'name' || key === 'admin') return str;
    if (key === 'trophy') return displayTrophyName(str);
    return toSentenceValue(str);
  });
}

/**
 * Closed registry. Q1 = B — N26/N27 kept for admin-gated special asks.
 */
export const NOTIFICATIONS: Record<NotificationId, NotificationDef> = {
  N01: {
    id: 'N01',
    audience: 'helper',
    title: 'Poppins',
    body: '{count} tasks due at {time}.',
  },
  N02: {
    id: 'N02',
    audience: 'helper',
    title: 'Poppins',
    body: '{task} is due at {time}.',
  },
  N03: {
    id: 'N03',
    audience: 'helper',
    title: 'Poppins · Photo',
    body: '{admin} asked for a photo of {task}.',
  },
  N04: {
    id: 'N04',
    audience: 'helper',
    title: 'Poppins · Streak',
    body: 'Your {streak}-day streak is at risk.',
  },
  N05: {
    id: 'N05',
    audience: 'helper',
    title: 'Poppins · Streak',
    body: 'Your {streak}-day streak is safe.',
  },
  N06: {
    id: 'N06',
    audience: 'helper',
    title: 'Poppins · Streak',
    body: 'Your streak ended at {streak} days.',
  },
  N07: {
    id: 'N07',
    audience: 'helper',
    title: 'Poppins · Reward',
    body: 'You earned {reward}.',
  },
  N08: {
    id: 'N08',
    audience: 'helper',
    title: 'Poppins · Reward',
    body: '{reward} is ready. Waiting on a grown-up.',
  },
  N09: {
    id: 'N09',
    audience: 'helper',
    title: 'Poppins · Reward',
    body: '{admin} approved {reward}.',
  },
  N10: {
    id: 'N10',
    audience: 'helper',
    title: 'Poppins · Reward',
    body: '{admin} said not this time for {reward}.',
  },
  N11: {
    id: 'N11',
    audience: 'helper',
    title: 'Poppins · Tasks',
    body: '{admin} marked {task} as not done yet.',
  },
  N12: {
    id: 'N12',
    audience: 'helper',
    title: 'Poppins · Trophy',
    body: 'Trophy unlocked: {trophy}.',
  },
  N13: {
    id: 'N13',
    audience: 'helper',
    title: 'Poppins · Crown',
    body: "You took the Week's Crown.",
  },
  N14: {
    id: 'N14',
    audience: 'helper',
    title: 'Poppins · Allowance',
    body: 'Your {amount} allowance is marked paid.',
  },
  N15: {
    id: 'N15',
    audience: 'helper',
    title: 'Poppins · Recess',
    body: "You're on recess. Your {streak}-day streak is safe.",
  },
  N16: {
    id: 'N16',
    audience: 'helper',
    title: 'Poppins · Recess',
    body: 'Recess is over. Tasks start again tomorrow.',
  },
  N17: {
    id: 'N17',
    audience: 'admin',
    title: 'Poppins · Tasks',
    body: '{name} completed {count} tasks. +{xp} XP.',
  },
  N18: {
    id: 'N18',
    audience: 'admin',
    title: 'Poppins · Tasks',
    body: '{name} completed {task}. +{xp} XP.',
  },
  N19: {
    id: 'N19',
    audience: 'admin',
    title: 'Poppins · Homework',
    body: "{name}'s homework is ready to check.",
  },
  N20: {
    id: 'N20',
    audience: 'admin',
    title: 'Poppins · Photo',
    body: '{name} sent a photo of {task}.',
  },
  N21: {
    id: 'N21',
    audience: 'admin',
    title: 'Poppins · Reward',
    body: '{name} earned {reward}. Ready to approve.',
  },
  N22: {
    id: 'N22',
    audience: 'admin',
    title: 'Poppins · Allowance',
    body: 'Allowance is ready to approve for {count} people.',
  },
  N23: {
    id: 'N23',
    audience: 'admin',
    title: 'Poppins · Streak',
    body: "{name}'s {streak}-day streak is at risk.",
  },
  N24: {
    id: 'N24',
    audience: 'admin',
    title: 'Poppins · Crown',
    body: "{name} took the Week's Crown.",
  },
  N25: {
    id: 'N25',
    audience: 'admin',
    title: 'Poppins · Setup',
    body: '{count} people still need tasks.',
  },
  /** Q1 = B — child asks for an existing catalogue reward. */
  N26: {
    id: 'N26',
    audience: 'admin',
    title: 'Poppins · Reward',
    body: '{name} asked for {reward}.',
  },
  /** Q1 = B — child asks for something not yet minted. */
  N27: {
    id: 'N27',
    audience: 'admin',
    title: 'Poppins · Reward',
    body: '{name} asked for something new: {detail}.',
  },
  N28: {
    id: 'N28',
    audience: 'helper',
    title: 'Poppins · Tasks',
    body: '{admin} sent a reminder about {task}.',
  },
};

export function getNotification(id: NotificationId): NotificationDef {
  return NOTIFICATIONS[id];
}
