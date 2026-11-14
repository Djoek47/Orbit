/**
 * How many Poppins actions this household gets each month, right now.
 *
 * Paid households get TOKENS_PER_MONTH. A household on its free trial gets none: the trial
 * proves the chores are worth paying for, and Poppins is the thing being sold, so a trial
 * household runs Poppins on bought credits only.
 *
 * The number used to be the constant itself, read directly in eight places — the meter, the
 * charge path, the credits screen, the orb's glow. Threading a parameter through all of them
 * would have meant every future caller remembering to pass it, and the first one to forget
 * would hand a trial household 300 free actions. So it lives here instead: the access hook
 * sets it once when the household's state is known, and everything that used the constant
 * now asks this.
 *
 * Defaults to the paid allowance, which is today's behaviour — Expo Go, unit tests and the
 * first frame before the entitlement loads all see what they always did.
 */
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';

let current = TOKENS_PER_MONTH;

export function currentMonthlyAllowance(): number {
  return current;
}

/** Set by the access hook. Clamped, so a bad value can never hand out negative or fractional actions. */
export function setCurrentMonthlyAllowance(next: number): void {
  current = Number.isFinite(next) ? Math.max(0, Math.round(next)) : TOKENS_PER_MONTH;
}

/** For tests: put the paid default back. */
export function resetMonthlyAllowance(): void {
  current = TOKENS_PER_MONTH;
}

/**
 * A share of the month's allowance, safe when the allowance is zero.
 *
 * Several places divide by it to draw the orb's glow or warn at 80%. With a trial allowance of
 * zero that division would be NaN, and NaN in a style prop renders nothing at all.
 */
export function allowanceFraction(used: number, allowance = current): number {
  if (allowance <= 0) return used > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, used / allowance));
}
