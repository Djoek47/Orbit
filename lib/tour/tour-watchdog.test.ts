/**
 * Watchdog: invisible card → skip; two in a row → abort.
 * Work Order 9.3 §3.4 / §4.
 */
import assert from 'node:assert/strict';

/**
 * Pure helper mirroring TourProvider watchdog streak logic.
 */
export function nextWatchdogAction(streakAfterIncrement: number): 'skip_step' | 'abort' {
  return streakAfterIncrement >= 2 ? 'abort' : 'skip_step';
}

assert.equal(nextWatchdogAction(1), 'skip_step');
assert.equal(nextWatchdogAction(2), 'abort');
assert.equal(nextWatchdogAction(3), 'abort');

console.log('PASS tour-watchdog');
