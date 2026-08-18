/**
 * Session epoch + signed-out restart — remount Get Started instead of stacking it.
 * Run: npx --yes tsx lib/navigation/session-restart.test.ts
 */
import assert from 'node:assert/strict';

import { restartSignedOutSession, SESSION_RESTART_ROUTE } from './session-restart';
import {
  bumpSessionEpoch,
  getSessionEpoch,
  resetSessionEpochForTests,
  subscribeSessionEpoch,
} from './session-epoch';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function main() {
  resetSessionEpochForTests();

  {
    assert.equal(getSessionEpoch(), 0);
    const next = bumpSessionEpoch();
    assert.equal(next, 1);
    assert.equal(getSessionEpoch(), 1);
    pass('bump increments the session epoch');
  }

  {
    const seen: number[] = [];
    const unsub = subscribeSessionEpoch(() => seen.push(getSessionEpoch()));
    bumpSessionEpoch();
    bumpSessionEpoch();
    unsub();
    bumpSessionEpoch();
    assert.deepEqual(seen, [2, 3]);
    pass('subscribers fire until unsubscribed');
  }

  resetSessionEpochForTests();

  {
    const calls: string[] = [];
    const epoch = restartSignedOutSession({
      canDismiss: () => true,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.equal(SESSION_RESTART_ROUTE, '/');
    assert.deepEqual(calls, ['dismissAll', 'replace:/']);
    assert.equal(epoch, 1);
    assert.equal(getSessionEpoch(), 1);
    pass('restart dismisses modals, replaces /, and remounts');
  }

  {
    const calls: string[] = [];
    restartSignedOutSession({
      canDismiss: () => false,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.deepEqual(calls, ['replace:/']);
    pass('restart skips dismiss when nothing is presented');
  }

  {
    const calls: string[] = [];
    restartSignedOutSession({
      canDismiss: () => {
        throw new Error('no navigator');
      },
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => {
        if (href === '/') throw new Error('replace failed');
        calls.push(`replace:${href}`);
      },
    });
    assert.deepEqual(calls, ['replace:/welcome']);
    pass('restart falls back to /welcome if / replace throws');
  }

  resetSessionEpochForTests();
}

main();
