/**
 * Session epoch + signed-out restart — land Get Started without remounting.
 * Run: npx --yes tsx lib/navigation/session-restart.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applySignedOutNavigation,
  cancelSignedOutRestart,
  remountSignedOutSession,
  restartSignedOutSession,
  scheduleSignedOutRestart,
  SESSION_NAV_DELAY_MS,
  SESSION_REMOUNT_DELAY_MS,
  SESSION_RESTART_ROUTE,
} from './session-restart';
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
    applySignedOutNavigation({
      canDismiss: () => true,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.equal(SESSION_RESTART_ROUTE, '/');
    assert.deepEqual(calls, ['dismissAll', 'replace:/']);
    assert.equal(getSessionEpoch(), 0);
    pass('navigation dismisses and replaces without remounting');
  }

  {
    const calls: string[] = [];
    restartSignedOutSession({
      canDismiss: () => true,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.deepEqual(calls, ['dismissAll', 'replace:/']);
    assert.equal(getSessionEpoch(), 0);
    pass('sync restart does not remount (IPA 50 login crash)');
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

  {
    assert.ok(SESSION_NAV_DELAY_MS >= 400, 'nav waits past 120ms native close');
    const scheduled: Array<{ ms: number; fn: () => void }> = [];
    const calls: string[] = [];
    const handles: Array<{ ms: number; fn: () => void }> = [];
    scheduleSignedOutRestart(
      {
        canDismiss: () => true,
        dismissAll: () => calls.push('dismissAll'),
        replace: (href) => calls.push(`replace:${href}`),
      },
      (fn, ms) => {
        const item = { ms, fn };
        scheduled.push(item);
        handles.push(item);
        return item;
      },
      (handle) => {
        const idx = scheduled.indexOf(handle as (typeof scheduled)[0]);
        if (idx >= 0) scheduled.splice(idx, 1);
      },
    );
    assert.deepEqual(
      scheduled.map((item) => item.ms),
      [SESSION_NAV_DELAY_MS],
    );
    assert.equal(
      scheduled.some((item) => item.ms === SESSION_REMOUNT_DELAY_MS),
      false,
      'IPA 50 must not remount Stack after Get Started',
    );
    scheduled[0].fn();
    assert.deepEqual(calls, ['dismissAll', 'replace:/']);
    assert.equal(getSessionEpoch(), 0);
    pass('scheduled restart navigates only — no remount');
  }

  {
    const scheduled: Array<{ fn: () => void }> = [];
    scheduleSignedOutRestart(
      {
        replace: () => {
          throw new Error('should have been cancelled');
        },
      },
      (fn) => {
        scheduled.push({ fn });
        return scheduled[scheduled.length - 1];
      },
      (handle) => {
        const idx = scheduled.indexOf(handle as (typeof scheduled)[0]);
        if (idx >= 0) scheduled.splice(idx, 1);
      },
    );
    cancelSignedOutRestart();
    assert.equal(scheduled.length, 0);
    pass('login/create can cancel a pending sign-out restart');
  }

  {
    remountSignedOutSession();
    assert.equal(getSessionEpoch(), 1);
    pass('remount helper still exists for tests');
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
    assert.equal(
      layout.includes('<OrbitProvider key={sessionEpoch}>'),
      false,
      'OrbitProvider must stay mounted',
    );
    const settings = readFileSync(join(root, 'app/settings.tsx'), 'utf8');
    const del = readFileSync(join(root, 'app/delete-account.tsx'), 'utf8');
    assert.ok(settings.includes('resetToGetStarted()'));
    assert.ok(settings.includes('finally'));
    assert.ok(del.includes('resetToGetStarted()'));
    const reset = readFileSync(join(root, 'lib/navigation/reset-to-get-started.ts'), 'utf8');
    assert.ok(reset.includes('scheduleSignedOutRestart'));
    assert.ok(reset.includes('cancelSignedOutRestart'));
    const signIn = readFileSync(join(root, 'app/sign-in.tsx'), 'utf8');
    const welcome = readFileSync(join(root, 'app/welcome.tsx'), 'utf8');
    const confirm = readFileSync(join(root, 'app/confirm-email.tsx'), 'utf8');
    assert.ok(signIn.includes('cancelSignedOutRestart()'));
    assert.ok(welcome.includes('cancelSignedOutRestart()'));
    assert.ok(confirm.includes('cancelSignedOutRestart()'));
    pass('sign-out lands Get Started; login cancels leftover timers');
  }

  resetSessionEpochForTests();
}

main();
