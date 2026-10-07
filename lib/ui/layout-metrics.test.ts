/**
 * The app column against the real devices it has to fit.
 *
 * Sizes are the windows iOS reports, in points: every current iPhone in portrait, both of the
 * iPhone Duo's screens (466 × 678 outer, 669 × 951 inner), and the iPads full screen in both
 * orientations plus the Split View slices iPadOS can hand us at any moment.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COLUMN_MAX,
  COLUMN_MAX_WIDE,
  columnWidth,
  gridColumns,
  isColumnInset,
  layoutClass,
} from './layout-metrics';

// ── Phones and the Duo: the column is the window, untouched ──────────────────
for (const [name, w] of [
  ['iPhone SE', 375],
  ['iPhone 17', 393],
  ['iPhone 17 Pro Max', 440],
  ['iPhone Duo, outer', 466],
  ['iPhone Duo, inner', 669],
] as const) {
  assert.equal(columnWidth(w), w, `${name}: full width, no margins`);
  assert.equal(isColumnInset(w), false, `${name}: nothing to paint either side`);
}

assert.equal(layoutClass(393), 'phone');
assert.equal(layoutClass(466), 'phone', 'the Duo folded is a phone');
assert.equal(layoutClass(669), 'fold', 'the Duo open is the in-between class');

// ── iPad: centred and capped ─────────────────────────────────────────────────
for (const [name, w] of [
  ['iPad mini portrait', 744],
  ['iPad Air 11" portrait', 820],
  ['iPad Pro 13" portrait', 1032],
] as const) {
  assert.equal(columnWidth(w), COLUMN_MAX, `${name}: capped`);
  assert.equal(isColumnInset(w), true, `${name}: margins either side`);
}
for (const [name, w] of [
  ['iPad Air 11" landscape', 1180],
  ['iPad Pro 13" landscape', 1376],
] as const) {
  assert.equal(columnWidth(w), COLUMN_MAX_WIDE, `${name}: the wider cap`);
}
assert.equal(layoutClass(1032), 'tablet');
assert.equal(layoutClass(1376), 'tablet');

// ── Split View and Slide Over: whatever slice iPadOS hands us ────────────────
// A third of a landscape iPad, half of one, two thirds: every width must still get a column
// no wider than the window, or content runs off the edge.
for (const w of [320, 375, 507, 678, 694, 834, 981]) {
  const col = columnWidth(w);
  assert.ok(col <= w, `${w}pt slice: column never exceeds the window`);
  assert.ok(col > 0, `${w}pt slice: and is never zero`);
}

// ── Never broken by a bad reading ────────────────────────────────────────────
assert.equal(columnWidth(Number.NaN), COLUMN_MAX);
assert.equal(columnWidth(0), COLUMN_MAX);
assert.equal(columnWidth(-5), COLUMN_MAX);
assert.equal(layoutClass(Number.NaN), 'phone');

// ── Grid columns ─────────────────────────────────────────────────────────────
assert.equal(gridColumns(393, 90, 4), 4);
assert.equal(gridColumns(720, 90, 4), 4, 'capped at the designed count');
assert.equal(gridColumns(200, 90, 4), 2);
assert.equal(gridColumns(50, 90, 4), 1, 'always at least one');
assert.equal(gridColumns(Number.NaN, 90, 4), 1);

// ── Wiring ───────────────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(p, 'utf8');
const root = read('app/_layout.tsx');
assert.match(root, /<OrbitAppColumn>\s*<Stack/, 'the navigator lives in the column');

// Nothing measures the screen once at load any more — it would size for a window that is gone.
assert.doesNotMatch(read('components/orbit/bottom-sheet.tsx'), /Dimensions\.get\(/);
assert.doesNotMatch(read('app/setup-kid-device.tsx'), /Dimensions\.get\(/);

// Native Modals render outside the column, so each bottom sheet puts itself back in it.
for (const file of [
  'components/orbit/bottom-sheet.tsx',
  'components/orbit/house-rules/deadline-picker.tsx',
  'components/orbit/task-picker.tsx',
  'app/create-task.tsx',
  'components/orbit/near-shop-watcher.tsx',
]) {
  assert.match(read(file), /useModalColumnStyle|useContentWidth/, `${file} stays in the column`);
}

// iPad must declare every orientation (TN3192); iPhone keeps portrait.
const appJson = JSON.parse(read('app.json')) as {
  expo: { orientation: string; ios: { supportsTablet: boolean; infoPlist: Record<string, unknown> } };
};
assert.equal(appJson.expo.orientation, 'portrait', 'iPhone stays portrait');
assert.deepEqual(
  [...(appJson.expo.ios.infoPlist['UISupportedInterfaceOrientations~ipad'] as string[])].sort(),
  [
    'UIInterfaceOrientationLandscapeLeft',
    'UIInterfaceOrientationLandscapeRight',
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationPortraitUpsideDown',
  ],
  'iPad supports all four'
);
assert.equal(appJson.expo.ios.infoPlist.UIRequiresFullScreen, undefined, 'deprecated key stays out');

console.log('layout-metrics: ok');
