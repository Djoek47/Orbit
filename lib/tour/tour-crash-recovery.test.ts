/**
 * Crash-loop recovery: recoveredAt must not re-fire for the same lastError.
 * recoverStuckTourIfNeeded is one promise per JS runtime (app launch).
 * Run: npx --yes tsx lib/tour/tour-crash-recovery.test.ts
 */
import assert from 'node:assert/strict';

import {
  recoverStuckTourIfNeeded,
  resetTourRecoveryLaunchMemoForTests,
  shouldRecoverTourError,
} from '@/lib/tour/tour-crash-recovery';

assert.equal(shouldRecoverTourError('2026-09-21T12:00:00.000Z', null), true);
assert.equal(
  shouldRecoverTourError('2026-09-21T12:00:00.000Z', '2026-09-21T12:00:00.000Z'),
  false,
  'same lastError.at must not recover again'
);
assert.equal(shouldRecoverTourError('2026-09-21T13:00:00.000Z', '2026-09-21T12:00:00.000Z'), true);

async function main() {
  resetTourRecoveryLaunchMemoForTests();
  const first = recoverStuckTourIfNeeded('hh-launch', 'member-launch');
  const second = recoverStuckTourIfNeeded('hh-launch', 'member-launch');
  assert.equal(first, second, 'recoverStuckTourIfNeeded shares one promise per launch');
  await Promise.allSettled([first, second]);
  console.log('PASS tour-crash-recovery recoveredAt + launch memo');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
