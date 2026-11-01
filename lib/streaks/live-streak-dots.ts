/**
 * Live streak cliff dots for Home / Activity.
 *
 * House Rules teach that a streak ends after N consecutive misses
 * (`constants.streak.consecutiveMissesToEnd`, default 3). The chapter diagram
 * paints a static “almost lost” state. Live surfaces must reflect the member’s
 * real streak instead — at 0 days every dot is empty, not two red of three.
 */

export type LiveStreakDotKind = 'won' | 'empty';

export type LiveStreakDotsModel = {
  total: number;
  /** How many leading dots are lit as wins (capped at total). */
  won: number;
  kinds: LiveStreakDotKind[];
  /** Short caption under the dots. */
  caption: string;
};

export function liveStreakDotsModel(input: {
  streakDays: number;
  consecutiveMissesToEnd?: number;
}): LiveStreakDotsModel {
  const total = Math.max(1, Math.round(input.consecutiveMissesToEnd ?? 3));
  const streak = Math.max(0, Math.floor(input.streakDays));
  const won = Math.min(total, streak);
  const kinds: LiveStreakDotKind[] = Array.from({ length: total }, (_, i) =>
    i < won ? 'won' : 'empty'
  );
  const caption =
    streak <= 0
      ? 'No streak yet — finish today’s daily jobs'
      : streak === 1
        ? '1 day live'
        : `${streak} days live`;
  return { total, won, kinds, caption };
}
