/**
 * Crash-loop recovery: recoveredAt must not re-fire for the same lastError.
 * Run: npx --yes tsx lib/tour/tour-crash-recovery.test.ts
 */
import assert from 'node:assert/strict';

import { shouldRecoverTourError } from '@/lib/tour/tour-crash-recovery';

assert.equal(shouldRecoverTourError('2026-09-21T12:00:00.000Z', null), true);
assert.equal(
  shouldRecoverTourError('2026-09-21T12:00:00.000Z', '2026-09-21T12:00:00.000Z'),
  false,
  'same lastError.at must not recover again'
);
assert.equal(shouldRecoverTourError('2026-09-21T13:00:00.000Z', '2026-09-21T12:00:00.000Z'), true);

console.log('PASS tour-crash-recovery recoveredAt');
