/**
 * Shopping run: folding dock stays; Lock Screen grocery banner is off in the app for now.
 * Run: npx tsx lib/grocery/shopping-run-ui.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const dock = read('components/orbit/grocery/shopping-dock.tsx');
assert.match(dock, /useState\(false\)/, 'the dock starts closed — only the + shows');
assert.match(dock, /position: 'absolute'[\s\S]*right: 0/, 'the + is pinned to the right, never flexed off-screen');
assert.match(dock, /EDGE = 20/, 'inset from the screen edge so the circle is not cropped');
assert.match(dock, /returnKeyType="done"/, "the keyboard's blue ✓");
assert.match(dock, /if \(empty\) \{\s*closeDock\(\);/, '✓ with nothing typed folds it back and adds nothing');
assert.match(dock, /\{open \? \(\s*<AppTextInput\s*autoFocus/, 'opening brings the keyboard up');
assert.match(dock, /withSpring\(1/, 'open springs out from the +');
assert.match(dock, /paddingRight: BUTTON/, 'field never shares layout with the +');

const screen = read('app/shopping-mode.tsx');
assert.doesNotMatch(screen, /startShoppingBanner/, 'Lock Screen grocery banner is not started');
assert.doesNotMatch(screen, /updateShoppingBanner/, 'Lock Screen grocery banner is not updated');
assert.doesNotMatch(screen, /loadShoppingBannerEnabled/, 'no Lock Screen switch pref');
assert.doesNotMatch(screen, /drainLockScreenCheckOffs/, 'no Lock Screen check-off drain');
assert.match(screen, /stopShoppingBanner/, 'leftover banners from older builds are cleared');
assert.match(screen, /showEndRun/, 'End run stays in-app');

const header = read('components/orbit/grocery/shopping-run-header.tsx');
assert.doesNotMatch(header, /lockScreen/, 'no Lock Screen switch in the header');
assert.doesNotMatch(header, /accessibilityRole="switch"/, 'no Lock Screen toggle');
assert.match(header, /showEndRun/, 'End run is driven by the in-app list');

// Native stubs may remain for a future re-enable / trip Live Activity shared widget —
// but the shopping app path must not wire them.
assert.ok(
  existsSync(join(process.cwd(), 'lib/grocery/shopping-live-activity.ts')),
  'stop helper kept so older activities can be dismissed'
);

console.log('shopping-run-ui: ok');
