/**
 * The tour engine's guarantees — the ones that broke on device.
 *
 *   1. Demonstrations never navigate (two copies of the app stacked behind a demo).
 *   2. Only one place navigates, and only when the step changes.
 *   3. Every screen a step scrolls has registered its ScrollView under its own key.
 *   4. Look-only steps hold the whole screen still (Base/Max ended the tour).
 *   5. Chapters pin the section they show (Tasks opened on Homework).
 *
 * Run: npx tsx lib/tour/tour-engine.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { demoForStep, TOUR_DEMO_IDS } from '@/lib/tour/tour-demos';
import { targetScrolls, tourScreenKey } from '@/lib/tour/tour-scroll';
import { allTourSteps, getTourDefinition } from '@/lib/tour/tour-steps';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const provider = read('components/orbit/tour/tour-provider.tsx');
const overlay = read('components/orbit/tour/tour-overlay.tsx');
const panel = read('components/orbit/tour/tour-demo-panel.tsx');

// 1 · Demos.
assert.ok(!existsSync(join(process.cwd(), 'app/tour/mock-flow.tsx')), 'the mock-flow route is gone');
assert.doesNotMatch(provider, /DEMO_ROUTES/, 'no table of demo routes');
assert.doesNotMatch(provider, /router\.push\(demo/, 'a demo is never pushed');
assert.match(provider, /setDemo\(demoId\)/, 'Next on a demo step opens the panel');
assert.match(provider, /!demo && \(!paused/, 'no step is active while a demo plays');
assert.match(provider, /const closeDemo = useCallback/, 'the tour moves on when the panel closes');
assert.doesNotMatch(panel, /router\./, 'the panel never touches the navigator');
for (const id of TOUR_DEMO_IDS) assert.match(panel, new RegExp(`case '${id}'`), `panel plays ${id}`);

for (const { tourId, step } of allTourSteps()) {
  const demo = demoForStep(step);
  if (step.primaryAction && step.primaryAction !== 'open_settings') {
    assert.ok(demo, `${tourId}/${step.id} action ${step.primaryAction} maps to a demo`);
  }
  if (demo) assert.equal(step.centered, true, `${step.id}: a demo step has no spotlight to chase`);
  assert.notEqual(step.primaryAction, 'open_settings', `${step.id}: nothing ends the tour mid-way`);
}

// 2 · Navigation.
const navCalls = provider.match(/router\.navigate\(/g) ?? [];
const navBlock = provider.slice(provider.indexOf('// 1 · Navigation.'), provider.indexOf('// 2 · Arrive.'));
const arriveBlock = provider.slice(provider.indexOf('// 2 · Arrive.'), provider.indexOf('// Listen for event advances'));
assert.ok(navBlock.includes('router.navigate(route'), 'the navigation block navigates');
assert.match(navBlock, /\}, \[pointer\?\.step\.id\]\);/, 'and only when the step changes');
assert.match(navBlock, /router\.dismissAll\(\)/, 'closing anything presented first');
assert.doesNotMatch(arriveBlock, /router\./, 'arriving never navigates');
assert.ok(navCalls.length <= 5, `few navigate calls overall (${navCalls.length})`);

// 3 · Scrolling. Every tab a step scrolls on registers under its own key.
const routes = new Set(
  allTourSteps()
    .filter(({ step }) => !step.centered && targetScrolls(step.targetId))
    .map(({ step }) => step.route)
);
const screenFile: Record<string, string> = {
  home: 'app/(tabs)/index.tsx',
  tasks: 'app/(tabs)/tasks.tsx',
  plan: 'app/(tabs)/plan.tsx',
  groceries: 'app/(tabs)/groceries.tsx',
  rewards: 'app/(tabs)/rewards.tsx',
};
for (const route of routes) {
  const key = tourScreenKey(route);
  if (key === 'poppins' || key === 'select-profile') continue; // fixed layouts
  const file = screenFile[key];
  assert.ok(file, `a screen file for ${route}`);
  assert.match(read(file!), /useTourScroll\('/, `${file} registers its ScrollView`);
}
assert.match(provider, /planTourScroll\(/, 'the scroll target is planned, not guessed');
assert.match(provider, /SCROLL_SETTLE_MS/, 'and the card waits for it to settle');

// 4 · Holding still.
assert.match(overlay, /!interactiveTarget \|\| !cutout/, 'a look step blocks the whole screen');
assert.match(provider, /interactiveTarget=\{isAction\}/);
assert.doesNotMatch(overlay, /FullWindowOverlay/, 'the coach card lives in the app window');
assert.match(overlay, /reserveTop: exitPillBottom/, 'the card keeps clear of Exit');

// 5 · Sections.
const admin = getTourDefinition('admin');
const tasks = admin.chapters.find((c) => c.id === 'tasks')!;
for (const s of tasks.steps.filter((x) => x.route === '/(tabs)/tasks' && !x.when)) {
  assert.equal(s.onEnter, 'tasks.chores', `${s.id} shows Chores`);
}
for (const s of admin.chapters.find((c) => c.id === 'homework')!.steps) {
  assert.equal(s.onEnter, 'tasks.homework', `${s.id} shows Homework`);
}

// Groceries step 2 targets a grid that only mounts when Browse is open.
const groceries = admin.chapters.find((c) => c.id === 'groceries')!;
assert.equal(groceries.steps.length, 3, 'groceries has add → aisle → store');
assert.equal(groceries.steps[0]?.onEnter, 'groceries.list', 'search step closes Browse');
assert.equal(groceries.steps[1]?.onEnter, 'groceries.browse', 'aisle step opens Browse');
assert.equal(groceries.steps[1]?.targetId, 'groceries.aisles');
assert.equal(groceries.steps[2]?.onEnter, 'groceries.list', 'store step closes Browse');
assert.match(
  read('app/(tabs)/groceries.tsx'),
  /setGroceryBrowse/,
  'groceries screen registers the Browse hook'
);
assert.match(read('lib/tour/tour-store.ts'), /groceries\.browse/);

// Chapters stay short.
for (const chapter of admin.chapters) {
  assert.ok(chapter.steps.length <= 6, `${chapter.id} has ${chapter.steps.length} steps`);
}

console.log(`tour-engine: ok (${allTourSteps().length} steps)`);
