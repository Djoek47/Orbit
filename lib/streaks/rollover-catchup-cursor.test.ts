/**
 * Run: npx --yes tsx --test lib/streaks/rollover-catchup-cursor.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { pendingCatchUpDays } from '@/lib/streaks/rollover-catchup-cursor';

describe('pendingCatchUpDays', () => {
  test('empty when no cursor (first seed trusts persisted streaks)', () => {
    assert.deepEqual(pendingCatchUpDays(null, '2026-10-05'), []);
  });

  test('empty when already caught up through yesterday', () => {
    assert.deepEqual(pendingCatchUpDays('2026-10-05', '2026-10-05'), []);
    assert.deepEqual(pendingCatchUpDays('2026-10-06', '2026-10-05'), []);
  });

  test('returns only days after cursor', () => {
    assert.deepEqual(pendingCatchUpDays('2026-10-03', '2026-10-05'), [
      '2026-10-04',
      '2026-10-05',
    ]);
  });
});
