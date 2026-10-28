/**
 * WO13 A5 — the orb stays mounted when the stage is live (smoke).
 * Run: npx tsx lib/poppins/orb-live-smoke.test.ts
 *
 * A full render needs React Native; this asserts the layout contract the tab must keep:
 *  - exactly one PoppinsOrb, at a stable position, never inside a live-only branch;
 *  - the stage scrolls in its own ScrollView BELOW the orb (the scroll never replaces it);
 *  - the dock is a sibling after the body, so a tall card cannot draw under the mic.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/(tabs)/poppins.tsx'), 'utf8');
const controller = readFileSync(join(process.cwd(), 'lib/poppins/use-poppins-controller.ts'), 'utf8');

// One orb, sized by the controller: 196 idle, 72 live or typing.
assert.equal(src.split('<PoppinsOrb').length - 1, 1, 'exactly one PoppinsOrb in the tab');
assert.match(controller, /const orbSize = drive\.live \|\| threadOpen \? 72 : 196/);
assert.match(src, /size=\{p\.orb\.size\}/, 'the one PoppinsOrb uses the controller size');
assert.match(src, /drainPreview=\{p\.orb\.drainPreview\}/, 'live path passes drainPreview into the orb');
assert.match(src, /key="orb"/, 'orb slot keeps a stable identity across idle ↔ live');
assert.match(src, /live \|\| p\.threadOpen \? styles\.orbSlotLive : styles\.orbSlotIdle/);

// The orb comes before, and outside, the stage scroll view.
const orbAt = src.indexOf('<PoppinsOrb');
const scrollAt = src.indexOf('<ScrollView');
const stageAt = src.indexOf('<PoppinsStage');
assert.ok(orbAt > 0 && scrollAt > orbAt && stageAt > scrollAt, 'orb, then the stage scroll, then the stage');
const scrollBlock = src.slice(scrollAt, src.indexOf('</ScrollView>', scrollAt));
assert.ok(!scrollBlock.includes('PoppinsOrb'), 'the stage scroll view never contains the orb');
const orbBranch = src.slice(Math.max(0, orbAt - 400), orbAt);
assert.ok(
  !/\{live \? \(\s*<View\s+key="orb"/.test(orbBranch),
  'the orb is not gated behind a live-only branch'
);

// The dock renders after the body — a sibling, never an overlay.
const bodyAt = src.indexOf('style={styles.body}');
const dockAt = src.indexOf('<PoppinsDock');
assert.ok(bodyAt > 0 && dockAt > bodyAt, 'dock is rendered after the body');
assert.doesNotMatch(src, /position: 'absolute',\s*\n\s*zIndex/, 'no absolute overlay over the stage');

console.log('orb-live-smoke.test.ts ok');
