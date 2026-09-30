/**
 * Shopping run: the folding dock, the Lock Screen switch, and ChoreMaxx's own Lock Screen view.
 * Run: npx tsx lib/grocery/shopping-run-ui.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const dock = read('components/orbit/grocery/shopping-dock.tsx');
assert.match(dock, /useState\(false\)/, 'the dock starts closed — only the + shows');
assert.match(dock, /alignSelf: 'flex-end'/, 'anchored at the button, so it opens out to the left');
assert.match(dock, /returnKeyType="done"/, "the keyboard's blue ✓");
assert.match(dock, /if \(empty\) \{\s*closeDock\(\);/, '✓ with nothing typed folds it back and adds nothing');
assert.match(dock, /\{open \? \(\s*<AppTextInput\s*autoFocus/, 'opening brings the keyboard up');

const screen = read('app/shopping-mode.tsx');
assert.match(screen, /loadShoppingBannerEnabled/, 'the Lock Screen switch is remembered');
assert.match(screen, /!bannerEnabled\) return/, 'off means no banner');
assert.match(screen, /iconForGroceryName\(item\.name, item\.categoryId\)/, 'items carry their emoji');
assert.match(read('components/orbit/grocery/shopping-run-header.tsx'), /accessibilityRole="switch"/);

const view = read('plugins/live-activity/LiveActivityView.swift');
assert.match(view, /struct LiveActivityView: View/, 'same view name the widget uses');
assert.match(view, /let contentState: LiveActivityAttributes\.ContentState/, 'same inputs');
assert.match(view, /Image\("choremaxx_mark"\)/, 'the logo');
assert.match(view, /LazyVGrid/, 'a two-column checklist');
assert.ok(existsSync(join(process.cwd(), 'assets/liveActivity/choremaxx_mark.png')), 'logo asset');
const appJson = read('app.json');
assert.ok(
  appJson.indexOf('"expo-live-activity"') < appJson.indexOf('with-shopping-live-activity'),
  'our view is copied in after the library'
);
assert.match(read('plugins/with-shopping-live-activity.js'), /withFinalizedMod/);

console.log('shopping-run-ui: ok');
