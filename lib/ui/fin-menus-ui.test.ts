/**
 * Final UI pass — built menus match glass / Poppins settings pattern.
 * Run: npx --yes tsx --test lib/ui/fin-menus-ui.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('transfer screen uses glass hero + SettingsGroup link row', () => {
  const src = read('app/transfer-household.tsx');
  assert.match(src, /LinearGradient/);
  assert.match(src, /styles\.hero/);
  assert.match(src, /SettingsGroup/);
  assert.match(src, /Copy link/);
  assert.doesNotMatch(src, /styles\.timerCard/);
  assert.doesNotMatch(src, /styles\.copyRow/);
});

test('delete screen uses danger hero and done SettingsGroup', () => {
  const src = read('app/delete-household.tsx');
  assert.match(src, /LinearGradient/);
  assert.match(src, /styles\.hero/);
  assert.match(src, /SettingsGroup header="More"/);
  assert.match(src, /Open recovery countdown/);
  assert.doesNotMatch(src, /styles\.warnIcon/);
  assert.doesNotMatch(src, /styles\.infoCard/);
});

test('support errors live in one glass group with compose header', () => {
  const src = read('app/support.tsx');
  assert.match(src, /Compose/);
  assert.match(src, /styles\.errGroup/);
  assert.match(src, /Saved errors/);
  assert.doesNotMatch(src, /styles\.errCard/);
});

test('recovery actions have coloured group label', () => {
  const src = read('app/household-recovery.tsx');
  assert.match(src, /Actions/);
  assert.match(src, /styles\.groupLabel/);
  assert.match(src, /styles\.actionGroup/);
});

test('premium paywall usage card uses glassFill not cardMuted', () => {
  const src = read('components/orbit/premium-paywall.tsx');
  assert.match(src, /glassFill\(isDark\)/);
  assert.doesNotMatch(src, /orbitPalette\.cardMuted/);
});

test('settings premium restore group is labelled Purchases', () => {
  const src = read('app/settings.tsx');
  assert.match(src, /header="Purchases"/);
  assert.match(src, /premiumHero/);
});
