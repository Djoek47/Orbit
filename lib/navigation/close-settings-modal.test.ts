/**
 * P0 — Settings close must not leave a touch-blocking modal; sign-out shows overlay.
 * Run: npx --yes tsx --test lib/navigation/close-settings-modal.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('closeSettingsModal uses leaveModalsToTabs dismissAll + replace', () => {
  const src = read('lib/navigation/close-settings-modal.ts');
  assert.match(src, /leaveModalsToTabs/);
  assert.match(src, /dismissAll/);
  assert.match(src, /replace/);
});

test('admin Settings X uses closeSettingsModal, not router.back alone', () => {
  const settings = read('app/settings.tsx');
  assert.match(settings, /closeSettingsModal/);
  assert.match(settings, /closeSettings/);
  assert.match(settings, /SigningOutOverlay/);
  assert.doesNotMatch(settings, /onPress=\{\(\) => router\.back\(\)\}/);
  assert.doesNotMatch(settings, /Email tests/);
  assert.doesNotMatch(settings, /Send test email/);
});

test('sidekick Settings X uses closeSettingsModal + signing-out overlay', () => {
  const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
  assert.match(sidekick, /closeSettingsModal/);
  assert.match(sidekick, /SigningOutOverlay/);
  assert.doesNotMatch(sidekick, /onPress=\{\(\) => router\.back\(\)\}/);
});

test('signOutAndLeave has hard ceiling so wipe cannot hang forever', () => {
  const leave = read('lib/auth/sign-out-and-leave.ts');
  assert.match(leave, /SIGNOUT_HARD_MS/);
  assert.match(leave, /withHardCeiling/);
  assert.match(leave, /resetToGetStarted/);
});
