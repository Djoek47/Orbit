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
    assert.equal(SESSION_RESTART_ROUTE, '/welcome');
    const calls: string[] = [];
    applySignedOutNavigation({
      canDismiss: () => true,
      dismissAll: () => calls.push('dismissAll'),
      dismissTo: (href) => calls.push(`dismissTo:${href}`),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.deepEqual(calls, ['dismissTo:/welcome']);
    assert.equal(getSessionEpoch(), 0);
    pass('navigation prefers dismissTo Get Started (no remount)');
  }

  {
    const calls: string[] = [];
    restartSignedOutSession({
      canDismiss: () => true,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.deepEqual(calls, ['dismissAll', 'replace:/welcome']);
    assert.equal(getSessionEpoch(), 0);
    pass('sync restart falls back to dismissAll + replace /welcome');
  }

  {
    const calls: string[] = [];
    restartSignedOutSession({
      canDismiss: () => false,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.deepEqual(calls, ['replace:/welcome']);
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
        if (href === '/welcome') throw new Error('replace welcome failed');
        calls.push(`replace:${href}`);
      },
    });
    assert.deepEqual(calls, ['replace:/']);
    pass('restart falls back to / if /welcome replace throws');
  }

  {
    const calls: string[] = [];
    restartSignedOutSession({
      dismissTo: () => {
        throw new Error('dismissTo failed');
      },
      canDismiss: () => true,
      dismissAll: () => calls.push('dismissAll'),
      replace: (href) => calls.push(`replace:${href}`),
    });
    assert.deepEqual(calls, ['dismissAll', 'replace:/welcome']);
    pass('dismissTo failure falls back to dismissAll + replace');
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
        dismissTo: (href) => calls.push(`dismissTo:${href}`),
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
    assert.deepEqual(calls, ['dismissTo:/welcome']);
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
      'tabs must not stack /welcome via Redirect',
    );
    assert.ok(
      tabs.includes("router.replace('/welcome'") || tabs.includes('router.replace("/welcome"'),
      'tabs safety net must replace /welcome when signed out',
    );
    const layout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
    assert.equal(
      layout.includes('<OrbitProvider key={sessionEpoch}>'),
      false,
      'OrbitProvider must stay mounted',
    );
    const settings = readFileSync(join(root, 'app/settings.tsx'), 'utf8');
    const del = readFileSync(join(root, 'app/delete-account.tsx'), 'utf8');
    assert.ok(
      settings.includes('signOutAndLeave') || settings.includes('resetToGetStarted()'),
      'Settings must leave Get Started after sign-out'
    );
    assert.ok(settings.includes('finally'));
    assert.ok(del.includes('resetToGetStarted()'));
    const reset = readFileSync(join(root, 'lib/navigation/reset-to-get-started.ts'), 'utf8');
    assert.ok(reset.includes('scheduleSignedOutRestart'));
    assert.ok(reset.includes('cancelSignedOutRestart'));
    assert.ok(reset.includes('dismissTo'), 'expo nav must wire dismissTo');
    const leave = readFileSync(join(root, 'lib/auth/sign-out-and-leave.ts'), 'utf8');
    assert.ok(leave.includes("dismissTo('/welcome'") || leave.includes('dismissTo("/welcome"'));
    const index = readFileSync(join(root, 'app/index.tsx'), 'utf8');
    assert.ok(index.includes('Redirect href="/welcome"'), 'index sends unsigned users to Get Started');
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
