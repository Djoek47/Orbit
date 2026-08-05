/**
 * ChoreMaxx Revision D vocabulary — user-facing terms.
 * No component should hardcode these strings; import from here.
 * Spec: docs/logic/choremaxx-revision-d-spec.md §0.3
 */

export const VOCAB = {
  /** Reduced-XP award for finishing after the deadline. */
  lateCredit: 'Late Credit',
  /** A task that passed 23:59 uncompleted. */
  expired: 'Expired',
  /** Paying XP to preserve a streak. */
  streakRescue: 'Streak Rescue',
  /** Pausing tasks while freezing streaks. */
  recess: 'Recess',
  /** The in-app rules manual. */
  houseRules: 'House Rules',
  /** Weekly XP champion. */
  weeksCrown: "The Week's Crown",
  /** Monthly XP champion. */
  monthlySovereign: 'Monthly Sovereign',
  /** The per-member detail sheet. */
  championsRecord: "Champion's Record",
  /** Display when tied at the top of a crown ranking. */
  tiedFor1st: 'Tied for 1st',
  /** Leaderboard label while on Recess. */
  onRecess: 'On recess',
  /** Quiet week — no crown. */
  noCrownThisWeek: "No crown this week — let's go again.",
  /** Free first-rescue prompt button. */
  rescueFree: 'Rescue my streak · Free',
  /** Free first-rescue helper under the button. */
  firstRescueOnUs: 'Your first rescue is on us.',
  /** Decline rescue — plain text, never a filled competing button. */
  keepXpInstead: 'Keep my XP instead',
  /** Expired tasks stay gone after a rescue. */
  rescueDoesNotRestoreTasks: "Either way, Wednesday's tasks are gone.",
} as const;

export type VocabKey = keyof typeof VOCAB;

/** Retired terms — must not appear in user-facing copy. */
export const RETIRED_VOCAB = [
  'Late penalty',
  'late completion',
  'Missed',
  'Streak redemption',
  'buy back',
  'Vacation mode',
  'Rules information',
  'Weekly winner',
  'Monthly winner',
  "Winner's sheet",
] as const;
