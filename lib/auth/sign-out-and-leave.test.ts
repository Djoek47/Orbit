/**
 * Sign-out must complete on the first press for every device type.
 * Run: npx --yes tsx lib/auth/sign-out-and-leave.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isSignOutInFlight,
  resetSignOutInFlightForTests,
  signOutAndLeave,
} from './sign-out-and-leave';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

async function main() {
  resetSignOutInFlightForTests();

  {
    let calls = 0;
    const signOut = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
    };
    const a = signOutAndLeave(signOut);
    assert.equal(isSignOutInFlight(), true);
    const b = signOutAndLeave(signOut);
    await Promise.all([a, b]);
    assert.equal(calls, 1, 'double-press coalesces onto one wipe');
    assert.equal(isSignOutInFlight(), false);
  }

  {
    let calls = 0;
    await signOutAndLeave(async () => {
      calls += 1;
      throw new Error('remote failed');
    });
    assert.equal(calls, 1, 'failures still leave (nav in finally)');
    assert.equal(isSignOutInFlight(), false);
  }

  // Pass 1 — Settings / Sidekick wire-up
  {
    const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
    assert.match(sidekick, /signOutAndLeave\(signOut\)/, 'Sidekick/shared uses one-shot leave');
    assert.match(sidekick, /style: 'destructive'/, 'shared-device confirm is destructive');
    assert.match(sidekick, /Signing out…/, 'busy label on first press');
    assert.match(sidekick, /isSignOutInFlight/, 'blocks stacked confirms');

    const settings = read('app/settings.tsx');
    assert.match(settings, /signOutAndLeave\(signOut\)/, 'admin uses one-shot leave');
    assert.match(settings, /confirmAdminSignOut/, 'admin confirms before leave');
    assert.match(settings, /Signing out…/, 'admin busy label');
    assert.match(
      read('app/_layout.tsx'),
      /GlobalSigningOutCover/,
      'root cover survives Settings unmount'
    );

    const leave = read('lib/auth/sign-out-and-leave.ts');
    assert.match(leave, /SIGNOUT_HARD_MS/, 'hard ceiling if wipe hangs');
    assert.match(leave, /SESSION_NAV_DELAY_MS/, 'hold cover through nav delay');
  }

  // Pass 2 — alert + removal Modal settle before navigation
  {
    const alert = read('components/orbit/orbit-alert.tsx');
    assert.match(alert, /onDismiss=\{flushAfterDismiss\}/, 'confirm waits for Modal dismiss');
    assert.match(alert, /ORBIT_ALERT_DISMISS_MS/, 'Android fallback after fade');
    assert.match(alert, /hasDestructive/, 'destructive alerts ignore backdrop dismiss');
    assert.match(alert, /presentationStyle="overFullScreen"/, 'layers over Settings modal');
    assert.equal(
      alert.includes('requestAnimationFrame(() => btn.onPress'),
      false,
      'must not fire onPress during Modal fade'
    );

    const countdown = read('components/orbit/member-removed-countdown.tsx');
    assert.match(countdown, /visible=\{visible\}/, 'removal Modal uses visible prop');
    assert.match(countdown, /presentationStyle="overFullScreen"/);
    assert.match(countdown, /leaveStartedRef/, 'Sign out now is one-shot');

    const store = read('store/orbit-store.tsx');
    assert.match(store, /MEMBER_REMOVAL_MODAL_SETTLE_MS/, 'kick waits for Modal settle');
    assert.match(store, /finishKickInFlightRef/, 'kick is one-shot');
    assert.match(
      store,
      /memberRemovalNotice/,
      'admin remove still creates inbox+push notice after roster delete'
    );
  }

  console.log('sign-out-and-leave: ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
