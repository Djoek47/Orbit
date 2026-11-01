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
    /collapseSettingsOverlays\(\);\s*closeSettingsModal\(\);\s*setSigningOut\(true\)/s,
    'sign-out closes sheets + Settings modal before overlay'
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
  assert.match(
    sidekick,
    /setPersonalizeOpen\(false\);\s*closeSettingsModal\(\);\s*setSigningOut\(true\)/s
  );
});

test('Pass C1: SigningOutOverlay hoisted to root (survives Settings unmount)', () => {
  assert.match(read('app/_layout.tsx'), /GlobalSigningOutCover/);
  assert.match(read('app/_layout.tsx'), /LegalLinksSheetHost/);
  assert.match(read('app/_layout.tsx'), /TourChapterSheetHost/);
  assert.match(read('components/orbit/global-signing-out-cover.tsx'), /subscribeSignOutInFlight/);
  assert.match(read('components/orbit/signing-out-overlay.tsx'), /Signing out…/);
  assert.doesNotMatch(read('app/settings.tsx'), /SigningOutOverlay/);
  assert.doesNotMatch(read('components/orbit/sidekick-settings-screen.tsx'), /SigningOutOverlay/);
});

test('Pass C1b: Settings X disabled while sign-out in flight', () => {
  const settings = read('app/settings.tsx');
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  assert.match(settings, /disabled=\{signingOut \|\| isSignOutInFlight\(\)\}/);
  assert.match(sidekick, /disabled=\{signingOut \|\| isSignOutInFlight\(\)\}/);
  assert.match(read('lib/auth/sign-out-and-leave.ts'), /SESSION_NAV_DELAY_MS/);
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

test('Pass C2b: Privacy & legal dismisses Settings then opens root sheet', () => {
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  const admin = read('app/settings.tsx');
  const menus = read('lib/ui/settings-native-menus.ts');
  assert.match(sidekick, /Privacy & legal[\s\S]{0,500}?closeSettingsModal\(\)/);
  assert.match(sidekick, /Privacy & legal[\s\S]{0,500}?showPrivacyLegalMenuAfterSettingsDismiss/);
  assert.match(admin, /Privacy & legal[\s\S]{0,500}?closeSettingsModal\(\)/);
  assert.match(admin, /Privacy & legal[\s\S]{0,500}?showPrivacyLegalMenuAfterSettingsDismiss/);
  assert.match(menus, /openLegalLinksSheet/);
  assert.match(menus, /SESSION_NAV_DELAY_MS/);
  assert.match(menus, /showPrivacyLegalMenuAfterSettingsDismiss/);
  const legalHost = read('components/orbit/settings/legal-links-sheet-host.tsx');
  assert.match(legalHost, /CHOREMAXX_LEGAL\.privacyUrl/);
  assert.match(legalHost, /FrostedPanel/);
  assert.match(legalHost, /onDismiss=\{flushAfterDismiss\}/);
  assert.match(legalHost, /beginDismiss/);
  assert.match(legalHost, /LEGAL_SHEET_DISMISS_MS|InteractionManager/);
  assert.match(legalHost, /router\.push\('\/support'/);
  assert.match(read('lib/legal/open-choremaxx-url.ts'), /openBrowserAsync/);
  assert.match(read('components/orbit/frosted-panel.tsx'), /frostFill/);
  assert.match(read('components/orbit/health/glass-detail-popover.tsx'), /FrostedPanel/);
  assert.doesNotMatch(sidekick, /Privacy & legal[\s\S]{0,400}?orbitAlert\(/);
  assert.doesNotMatch(admin, /Privacy & legal[\s\S]{0,400}?orbitAlert\(/);
  assert.match(admin, /handleDelete[\s\S]{0,120}?router\.push\('\/delete-account'/);
});

test('Pass C2c: Sign out confirm uses native menu (never orbitAlert over Settings)', () => {
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  const admin = read('app/settings.tsx');
  assert.match(sidekick, /confirmLeaveDevice/);
  assert.match(admin, /confirmLeaveDevice/);
  assert.match(sidekick, /closeSettingsModal\(\)/);
  assert.match(admin, /closeSettingsModal\(\)/);
  assert.doesNotMatch(sidekick, /orbitAlert\(model\.signOut/);
  assert.doesNotMatch(admin, /orbitAlert\('Sign out\?/);
});

test('Pass C3: orbitAlert defers destructive until Modal settles', () => {
  const alert = read('components/orbit/orbit-alert.tsx');
  assert.match(alert, /onDismiss=\{flushAfterDismiss\}/);
  assert.match(alert, /ORBIT_ALERT_DISMISS_MS/);
  assert.match(alert, /hasDestructive/);
  assert.equal(alert.includes('requestAnimationFrame(() => btn.onPress'), false);
});

test('Pass C4: session restart dismisses modals then lands Get Started (no auto remount)', () => {
  const restart = read('lib/navigation/session-restart.ts');
  assert.match(restart, /SESSION_RESTART_ROUTE = '\/welcome'/);
  assert.match(restart, /dismissTo/);
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
  assert.match(read('lib/navigation/reset-to-get-started.ts'), /dismissTo/);
  assert.match(read('lib/auth/sign-out-and-leave.ts'), /dismissTo\('\/welcome'/);
});
