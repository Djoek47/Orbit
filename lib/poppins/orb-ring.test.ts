/**
 * Month ring drains from the top.
 * Run: npx tsx lib/poppins/orb-ring.test.ts
 */
import assert from 'node:assert/strict';

import { monthRingDash } from '@/lib/poppins/orb-ring';

const radius = 100;
const circ = 2 * Math.PI * radius;

const full = monthRingDash(1, radius);
assert.equal(full.opacity > 0.9, true);
assert.ok(Math.abs(full.visible - circ) < 0.001);
assert.ok(Math.abs(full.offset - circ) < 0.001);

const half = monthRingDash(0.5, radius);
assert.ok(Math.abs(half.visible - circ / 2) < 0.001, 'half the stroke');
assert.ok(Math.abs(half.offset - (circ / 2 + circ) / 2) < 0.001, 'gap centered on top');
assert.ok(half.opacity < full.opacity, 'less credit, less light');

const quarter = monthRingDash(0.25, radius);
assert.ok(Math.abs(quarter.visible - circ / 4) < 0.001);
assert.ok(quarter.opacity < half.opacity);

const empty = monthRingDash(0, radius);
assert.equal(empty.visible, 0);
assert.equal(empty.opacity, 0);

const legacy = monthRingDash(Number.NaN, radius);
assert.equal(legacy.opacity, 0);

console.log('orb-ring: ok');
