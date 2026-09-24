/**
 * WO13 A5 — orb stays mounted when the stage is live (smoke).
 * Run: npx tsx lib/poppins/orb-live-smoke.test.ts
 *
 * Full render needs RN; this asserts the layout contract the tab must keep:
 * PoppinsOrb is not gated solely behind `!drive.live`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/(tabs)/poppins.tsx'), 'utf8');

assert.match(src, /drainPreview=\{drainPreview\}/, 'live path passes drainPreview into the orb');
assert.match(src, /orbSize/, 'single orb size driven by thread drawer / live');
assert.match(src, /size=\{orbSize\}/, 'one PoppinsOrb uses orbSize');
assert.match(src, /orbSlotLive/, 'live layout keeps an orb slot above the card');
assert.doesNotMatch(
  src,
  /drive\.live \?[\s\S]{0,80}<ScrollView[\s\S]{0,120}PoppinsStage/,
  'live stage must not be a ScrollView that replaces the orb wholesale'
);
assert.match(src, /stage is permanent/);
assert.match(src, /orbSlotLive : styles\.orbSlotIdle/);

console.log('orb-live-smoke.test.ts ok');
