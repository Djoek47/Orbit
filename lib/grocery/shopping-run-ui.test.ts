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
assert.match(dock, /position: 'absolute'[\s\S]*right: 0/, 'the + is pinned to the right, never flexed off-screen');
assert.match(dock, /EDGE = 20/, 'inset from the screen edge so the circle is not cropped');
assert.match(dock, /returnKeyType="done"/, "the keyboard's blue ✓");
assert.match(dock, /if \(empty\) \{\s*closeDock\(\);/, '✓ with nothing typed folds it back and adds nothing');
assert.match(dock, /\{open \? \(\s*<AppTextInput\s*autoFocus/, 'opening brings the keyboard up');
assert.match(dock, /withSpring\(1/, 'open springs out from the +');
assert.match(dock, /paddingRight: BUTTON/, 'field never shares layout with the +');

const screen = read('app/shopping-mode.tsx');
assert.match(screen, /loadShoppingBannerEnabled/, 'the Lock Screen switch is remembered');
assert.match(screen, /!bannerEnabled\) return/, 'off means no banner');
assert.match(screen, /iconForGroceryName\(item\.name, item\.categoryId\)/, 'items carry their emoji');
assert.match(screen, /remainingItems/, 'banner rows carry grocery ids');
assert.match(screen, /drainLockScreenCheckOffs/, 'Lock Screen taps sync into the list');
assert.match(read('components/orbit/grocery/shopping-run-header.tsx'), /accessibilityRole="switch"/);

const view = read('plugins/live-activity/LiveActivityView.swift');
assert.match(view, /struct LiveActivityView: View/, 'same view name the widget uses');
assert.match(view, /let contentState: LiveActivityAttributes\.ContentState/, 'same inputs');
assert.match(view, /Image\("choremaxx_mark"\)/, 'the logo');
assert.match(view, /ShoppingBannerPageIntent/, 'Next/Previous flip pages without opening the app');
assert.match(view, /ShoppingBannerCheckOffIntent/, 'row tap checks off without opening the app');
assert.match(view, /ShoppingBannerStore\.enqueueCheckOff/, 'check-off writes the App Group queue');
assert.match(view, /pageSize = 3/, 'roomy single-column pages');
assert.match(view, /rowHeight: CGFloat = 44/, 'even row rhythm');
assert.doesNotMatch(view, /LazyVGrid/, 'no cramped two-column grid');
assert.ok(existsSync(join(process.cwd(), 'assets/liveActivity/choremaxx_mark.png')), 'logo asset');
assert.ok(
  existsSync(join(process.cwd(), 'plugins/live-activity/ShoppingBannerStore.swift')),
  'shared App Group store'
);

const widget = read('plugins/live-activity/LiveActivityWidget.swift');
assert.match(widget, /LiveActivityView\(contentState/, 'lock screen hosts our view');
const lockScreenBlock = widget.slice(
  widget.indexOf('ActivityConfiguration'),
  widget.indexOf('} dynamicIsland:')
);
assert.doesNotMatch(
  lockScreenBlock,
  /\.applyWidgetURL/,
  'the whole banner is not a deep link — that swallowed every tap'
);
assert.match(widget, /compactTrailing/, 'Dynamic Island shows the left count');

const appJson = read('app.json');
assert.ok(
  appJson.indexOf('"expo-live-activity"') < appJson.indexOf('with-shopping-live-activity'),
  'our view is copied in after the library'
);
assert.doesNotMatch(
  appJson,
  /com\.apple\.security\.application-groups/,
  'main app App Group waits for refreshed App Store profile (see testflight-setup)'
);
assert.match(read('plugins/with-shopping-live-activity.js'), /LiveActivityWidget\.swift/);
assert.match(read('plugins/with-shopping-live-activity.js'), /ShoppingBannerStore\.swift/);
assert.match(read('plugins/with-shopping-live-activity.js'), /withFinalizedMod/);
assert.match(read('plugins/with-shopping-live-activity.js'), /group\.app\.choremaxx\.household/);
assert.match(read('lib/grocery/shopping-banner-copy.ts'), /#p\$\{/, 'page marker for the native pager');
assert.match(read('lib/grocery/shopping-banner-copy.ts'), /#id:/, 'item ids packed for check-off');

const bridge = read('modules/shopping-banner-bridge/index.ts');
assert.match(bridge, /ShoppingBannerBridge/, 'Expo module drains the App Group queue');

console.log('shopping-run-ui: ok');
