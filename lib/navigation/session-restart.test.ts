/**
 * Session epoch + signed-out restart — remount Get Started instead of stacking it.
 * Run: npx --yes tsx lib/navigation/session-restart.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const tabs = readFileSync(join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
    const signedOut = tabs.split('if (!isSignedIn)')[1]?.split('if (!currentUser')[0] ?? '';
    assert.ok(signedOut.includes('return null'), 'tabs must unmount when signed out');
    assert.equal(
      signedOut.includes('return <Redirect'),
      false,
      'tabs must not stack /welcome',
    );
    const layout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
    assert.ok(layout.includes('key={sessionEpoch}'), 'root must remount on session epoch');
    const settings = readFileSync(join(root, 'app/settings.tsx'), 'utf8');
    const del = readFileSync(join(root, 'app/delete-account.tsx'), 'utf8');
    assert.ok(settings.includes('resetToGetStarted()'));
    assert.ok(del.includes('resetToGetStarted()'));
    pass('sign-out and delete remount instead of stacking welcome');
  }

  resetSessionEpochForTests();
}

main();
