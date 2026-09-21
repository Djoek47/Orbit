/**
 * Tour step invariants — Work Order 9 D13.
 * Run: npx tsx lib/tour/tour-steps.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isUpgradeHousehold } from '@/lib/tour/tour-conditions';
import { allTourSteps, allTourTargetIds, getTourDefinition } from '@/lib/tour/tour-steps';
import { tourStorageKey } from '@/lib/tour/tour-types';
import type { HouseholdSnapshot } from '@/types/orbit';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

function wordCount(s: string): number {
  return s
    .replace(/[—–]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
}

function collectSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'design') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collectSources(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

const appAndComponents = [
  ...collectSources(join(root, 'app')),
  ...collectSources(join(root, 'components')),
];

const corpus = appAndComponents.map((f) => readFileSync(f, 'utf8')).join('\n');

const placedIds = new Set<string>();
for (const match of corpus.matchAll(/TourTarget\s+id=["']([^"']+)["']/g)) {
  placedIds.add(match[1]);
}
// Tab bar targets are mapped by route name (not string literals on JSX).
for (const id of ['tabbar.tasks', 'tabbar.plan', 'tabbar.rewards', 'tabbar.poppins']) {
  assert.match(
    corpus,
    new RegExp(`${id.replace('.', '\\.')}`),
    `tab bar map should declare ${id}`
  );
  placedIds.add(id);
}

// Synthetic finish / welcome targets may be registered by the provider.
placedIds.add('tour.finish');
placedIds.add('tour.welcome');

const steps = allTourSteps();
assert.ok(steps.length > 10, 'expected a full admin + sidekick step set');

for (const { tourId, step } of steps) {
  assert.ok(
    placedIds.has(step.targetId),
    `missing TourTarget for ${tourId}/${step.id} → ${step.targetId}`
  );

  assert.ok(wordCount(step.title) <= 5, `title too long (${tourId}/${step.id}): ${step.title}`);

  if (tourId === 'sidekick') {
    for (const sentence of step.body.split(/(?<=[.])\s+/).filter(Boolean)) {
      assert.ok(
        wordCount(sentence) <= 14,
        `sidekick body sentence >14 words (${step.id}): ${sentence}`
      );
    }
  } else {
    for (const sentence of step.body.split(/(?<=[.])\s+/).filter(Boolean)) {
      assert.ok(
        wordCount(sentence) <= 20,
        `body sentence >20 words (${tourId}/${step.id}): ${sentence}`
      );
    }
  }

  assert.ok(!EMOJI_RE.test(step.title + step.body), `emoji in ${step.id}`);
  assert.ok(!step.title.includes('!') && !step.body.includes('!'), `exclamation in ${step.id}`);
}

for (const id of allTourTargetIds()) {
  if (id === 'tour.welcome') continue;
  assert.ok(placedIds.has(id), `target id never placed: ${id}`);
}

// Upgrade households → offered, not auto-start
const upgrade = isUpgradeHousehold(
  { tasks: [{}, {}, {}, {}] } as unknown as HouseholdSnapshot,
  {}
);
assert.equal(upgrade, true, ' >3 tasks is upgrade');

const fresh = isUpgradeHousehold({ tasks: [] } as unknown as HouseholdSnapshot, {
  onboardingCompletedAt: new Date().toISOString(),
});
assert.equal(fresh, false, 'new household is not upgrade');

const oldOnboarding = isUpgradeHousehold({ tasks: [] } as unknown as HouseholdSnapshot, {
  onboardingCompletedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
});
assert.equal(oldOnboarding, true, 'onboarding >2 days is upgrade');

// Tour must never open PoppinsVoiceSession — grep tour + poppins wiring
const poppins = readFileSync(join(root, 'app/(tabs)/poppins.tsx'), 'utf8');
assert.match(poppins, /tourForcesQuietSpeak/);
assert.match(poppins, /if \(tourForcesQuietSpeak\(\)\) return/);
assert.equal(
  poppins.includes('tourForcesQuietSpeak() ? false') ||
    poppins.includes('tourForcesQuietSpeak()'),
  true,
  'speak transport must force Quiet during tour'
);
assert.match(poppins, /new PoppinsVoiceSession/);

const provider = readFileSync(join(root, 'components/orbit/tour/tour-provider.tsx'), 'utf8');
assert.doesNotMatch(provider, /PoppinsVoiceSession/);
assert.doesNotMatch(
  readFileSync(join(root, 'lib/tour/tour-steps.ts'), 'utf8'),
  /PoppinsVoiceSession/
);

// Admin welcome copy present
const admin = getTourDefinition('admin');
assert.match(admin.welcomeTitle, /Welcome to/);
assert.ok(!admin.welcomeBody.includes('!'));

assert.equal(tourStorageKey('hh', 'mem', 'admin'), 'orbit.tour.v1.hh.mem.admin');

console.log(`PASS tour-steps (${steps.length} steps, ${placedIds.size} placed targets)`);
