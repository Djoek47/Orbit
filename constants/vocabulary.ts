/**
 * ChoreMaxx Revision D / E vocabulary — user-facing terms.
 * No component should hardcode these strings; import from here.
 * Spec: docs/logic/choremaxx-revision-d-spec.md §0.3
 * Spec: docs/logic/choremaxx-revision-e-spec.md §1
 */

/** Intro splash slogans — Revision E §1.2. Exact text; sentence case with full stops. */
export const INTRO_SLOGANS = [
  'Built for real families with high standards.',
  "Everyone knows what's theirs to do.",
  'Poppins keeps the whole house in step.',
] as const;

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
  /** Monthly Rescue token button. */
  rescueFree: 'Rescue my streak · Free',
  /** Monthly token helper under the button. */
  firstRescueOnUs: 'Your monthly rescue token covers this.',
  /** Decline rescue — plain text, never a filled competing button. */
  keepXpInstead: 'Keep my XP instead',
  /** Expired tasks stay gone after a rescue. */
  rescueDoesNotRestoreTasks: "Either way, Wednesday's tasks are gone.",
  /** Create-action verb only — never a noun category. */
  mintAReward: 'Mint a reward',
  /** Origin badge on ledger rows (asked, not minted catalogue). */
  askedFor: 'Asked for',
  earned: 'Earned',
  /** Allowance tracker — never implies sending money. */
  approveNow: 'Approve now',
  markAsPaid: 'Mark as paid',
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
