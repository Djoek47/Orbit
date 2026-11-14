/**
 * P0 — Settings close must not leave a touch-blocking modal; sign-out shows overlay.
 * Run: npx --yes tsx --test lib/navigation/close-settings-modal.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('closeSettingsModal prefers dismiss, not replace-while-presented', () => {
  const src = read('lib/navigation/close-settings-modal.ts');
  assert.match(src, /leaveModalsToTabs/);
  assert.match(src, /dismiss:/);
  assert.match(src, /Never `replace/);
});

test('leaveModalsToTabs dismisses without replace when possible', () => {
  const src = read('lib/navigation/leave-modals-to-tabs.ts');
  assert.match(src, /nav\.dismiss\(\)/);
  assert.match(src, /invisible presentation/);
});

test('admin Settings X uses closeSettingsModal, not router.back alone', () => {
  const settings = read('app/settings.tsx');
  assert.match(settings, /closeSettingsModal/);
  assert.match(settings, /closeSettings/);
  assert.match(read('app/_layout.tsx'), /GlobalSigningOutCover/);
  assert.doesNotMatch(settings, /onPress=\{\(\) => router\.back\(\)\}/);
  assert.doesNotMatch(settings, /Email tests/);
  assert.doesNotMatch(settings, /Send test email/);
});

test('sidekick Settings X uses closeSettingsModal + root signing-out cover', () => {
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  assert.match(sidekick, /closeSettingsModal/);
  assert.match(sidekick, /closeSidekickSettings|setPersonalizeOpen\(false\)/);
  assert.match(read('app/_layout.tsx'), /GlobalSigningOutCover/);
  assert.doesNotMatch(sidekick, /onPress=\{\(\) => router\.back\(\)\}/);
});

test('signOutAndLeave has hard ceiling so wipe cannot hang forever', () => {
  const leave = read('lib/auth/sign-out-and-leave.ts');
  assert.match(leave, /SIGNOUT_HARD_MS/);
  assert.match(leave, /withHardCeiling/);
  assert.match(leave, /resetToGetStarted/);
});

test('root layout keeps Settings gestures enabled by default', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /name="settings"/);
  assert.match(layout, /gestureEnabled: true/);
  assert.match(layout, /fullScreenGestureEnabled: true/);
});

test('settings modal chrome dismisses stack without replace(/settings)', () => {
  const chrome = read('components/orbit/settings/modal-chrome.tsx');
  assert.match(chrome, /closeSettingsModalStack/);
  assert.doesNotMatch(chrome, /replace\('\/settings'/);
});

test('closeSettingsModalStack uses dismissAll not replace tabs', () => {
  const src = read('lib/navigation/close-settings-modal.ts');
  assert.match(src, /closeSettingsModalStack/);
  assert.match(src, /dismissAll/);
  assert.match(src, /Never `replace\('\/\(tabs\)'\)`/);
});
