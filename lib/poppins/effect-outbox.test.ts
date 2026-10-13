/**
 * Effect outbox — defer IUI notifies until undo window closes.
 * Run: npx --yes tsx lib/poppins/effect-outbox.test.ts
 */
import assert from 'node:assert/strict';

import { effectOutbox } from '@/lib/poppins/effect-outbox';

async function main() {
  effectOutbox.clearAll();

  {
    let ran = 0;
    effectOutbox.enqueue(
      {
        id: 'e1',
        beatId: 'beat-1',
        run: async () => {
          ran += 1;
        },
      },
      30
    );
    assert.deepEqual(effectOutbox.pendingBeatIds(), ['beat-1']);
    effectOutbox.discard('beat-1');
    assert.deepEqual(effectOutbox.pendingBeatIds(), []);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(ran, 0, 'discarded effect must never run');
  }

  {
    let ran = 0;
    effectOutbox.enqueue(
      {
        id: 'e2',
        beatId: 'beat-2',
        run: async () => {
          ran += 1;
        },
      },
      20
    );
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(ran, 1, 'window close runs once');
    assert.deepEqual(effectOutbox.pendingBeatIds(), []);
  }

  {
    let ran = 0;
    effectOutbox.enqueue(
      {
        id: 'e3',
        beatId: 'beat-3',
        run: async () => {
          ran += 1;
        },
      },
      10_000
    );
    await effectOutbox.flushAll();
    assert.equal(ran, 1, 'flushAll runs pending');
    assert.deepEqual(effectOutbox.pendingBeatIds(), []);
  }

  console.log('PASS effect-outbox');
}

void main();
