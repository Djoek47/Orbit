/**
 * Multi-pass QA — Settings leave + Sign Out must never leave Home untouchable
 * or hang on Settings.
 *
 * Pass A — dismiss-only close (no replace zombie layer)
 * Pass B — look-sheet torn down before Settings/Sign Out
 * Pass C — sign-out overlay + hard ceiling + alert settle
 *
 * Run: npx --yes tsx --test lib/navigation/settings-signout-multipass.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { leaveModalsToTabs } from '@/lib/navigation/leave-modals-to-tabs';
import {
  isSignOutInFlight,
  resetSignOutInFlightForTests,
  signOutAndLeave,
} from '@/lib/auth/sign-out-and-leave';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('Pass A1: dismiss-only when modal can dismiss (no replace)', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => true,
    dismiss: () => calls.push('dismiss'),
    dismissAll: () => calls.push('dismissAll'),
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['dismiss']);
});

test('Pass A2: second close still dismiss-only (idempotent path)', () => {
  const calls: string[] = [];
  const nav = {
    canDismiss: () => true,
    dismiss: () => calls.push('dismiss'),
    dismissAll: () => calls.push('dismissAll'),
    replace: (href: '/(tabs)') => calls.push(`replace:${href}`),
  };
  leaveModalsToTabs(nav);
  leaveModalsToTabs(nav);
  assert.deepEqual(calls, ['dismiss', 'dismiss']);
  assert.equal(calls.includes('replace:/(tabs)'), false);
});

test('Pass A3: admin + sidekick wire closeSettingsModal', () => {
  const settings = read('app/settings.tsx');
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  assert.match(settings, /closeSettingsModal/);
  assert.match(sidekick, /closeSettingsModal/);
  assert.doesNotMatch(settings, /onPress=\{\(\) => router\.back\(\)\}/);
  assert.doesNotMatch(sidekick, /onPress=\{\(\) => router\.back\(\)\}/);
});

test('Pass B1: admin close clears look sheet before dismiss', () => {
  const settings = read('app/settings.tsx');
  assert.match(
    settings,
    /collapseSettingsOverlays\(\);\s*closeSettingsModal\(\)/s,
    'close tears down PersonalizeLookSheet before modal dismiss'
  );
});

test('Pass B2: admin sign-out clears look sheet before overlay', () => {
  const settings = read('app/settings.tsx');
  assert.match(settings, /collapseSettingsOverlays/);
  assert.match(
    settings,
    /collapseSettingsOverlays\(\);\s*setSigningOut\(true\)/s,
    'sign-out closes sheets so RN Modals cannot block Get Started'
  );
});

test('Pass B4: house rules Change reuses settings — no push stack', () => {
  const hr = read('app/house-rules.tsx');
  assert.match(
    hr,
    /route\.startsWith\('\/settings'\)[\s\S]*router\.navigate\(route/,
    'fin/house-rules menus must not stack a second Settings sheet'
  );
});

test('Pass B5: modal chrome X uses dismissAll stack close', () => {
  const chrome = read('components/orbit/settings/modal-chrome.tsx');
  assert.match(chrome, /closeSettingsModalStack/);
  assert.doesNotMatch(chrome, /replace\('\/settings'/);
});

test('Pass B3: sidekick close + sign-out clear look sheet', () => {
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  assert.match(sidekick, /setPersonalizeOpen\(false\);\s*closeSettingsModal\(\)/s);
  assert.match(sidekick, /setPersonalizeOpen\(false\);\s*setSigningOut\(true\)/s);
});

test('Pass C1: SigningOutOverlay on admin + sidekick', () => {
  assert.match(read('app/settings.tsx'), /SigningOutOverlay/);
  assert.match(read('components/orbit/sidekick-settings-screen.tsx'), /SigningOutOverlay/);
  assert.match(read('components/orbit/signing-out-overlay.tsx'), /Signing out…/);
});

test('Pass C2: signOutAndLeave coalesces + hard ceiling + always navigates', async () => {
  resetSignOutInFlightForTests();
  let calls = 0;
  const a = signOutAndLeave(async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(isSignOutInFlight(), true);
  const b = signOutAndLeave(async () => {
    calls += 1;
  });
  await Promise.all([a, b]);
  assert.equal(calls, 1);
  assert.equal(isSignOutInFlight(), false);

  await signOutAndLeave(async () => {
    throw new Error('forced');
  });
  assert.equal(isSignOutInFlight(), false);

  const leave = read('lib/auth/sign-out-and-leave.ts');
  assert.match(leave, /SIGNOUT_HARD_MS/);
  assert.match(leave, /resetToGetStarted/);
});

test('Pass C3: orbitAlert defers destructive until Modal settles', () => {
  const alert = read('components/orbit/orbit-alert.tsx');
  assert.match(alert, /onDismiss=\{flushAfterDismiss\}/);
  assert.match(alert, /ORBIT_ALERT_DISMISS_MS/);
  assert.match(alert, /hasDestructive/);
  assert.equal(alert.includes('requestAnimationFrame(() => btn.onPress'), false);
});

test('Pass C4: session restart dismisses modals then replaces root (no auto remount)', () => {
  const restart = read('lib/navigation/session-restart.ts');
  assert.match(restart, /dismissAll/);
  assert.match(restart, /SESSION_NAV_DELAY_MS/);
  assert.match(restart, /applySignedOutNavigation/);
  // Sign-out timer must call applySignedOutNavigation — not remountSignedOutSession.
  assert.match(
    restart,
    /schedule\(\(\) => applySignedOutNavigation\(nav\), SESSION_NAV_DELAY_MS\)/
  );
  assert.doesNotMatch(
    restart,
    /schedule\(\(\) => remountSignedOutSession/
  );
});
