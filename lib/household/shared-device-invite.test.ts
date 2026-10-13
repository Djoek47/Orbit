/**
 * Shared-device invite + switch-icon geometry.
 * Run: npx tsx lib/household/shared-device-invite.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildSharedDeviceInviteLink,
  parseSharedDeviceInvitePayload,
} from '@/lib/household/shared-device-invite';
import {
  clampSwitchPeopleCount,
  switchDotRadius,
  switchPeopleEdges,
  switchPeopleNodes,
} from '@/lib/household/switch-people-geometry';

assert.equal(clampSwitchPeopleCount(1), 2);
assert.equal(clampSwitchPeopleCount(2), 2);
assert.equal(clampSwitchPeopleCount(6), 6);
assert.equal(clampSwitchPeopleCount(9), 6);
assert.equal(clampSwitchPeopleCount(Number.NaN), 2);

// ── One dot per person, one edge per hop ─────────────────────────────────────
for (const n of [2, 3, 4, 5, 6]) {
  assert.equal(switchPeopleNodes(n).length, n, `${n} people, ${n} dots`);
  assert.equal(switchPeopleEdges(n).length, n, `${n} people, ${n} edges`);
}

// Two people sit left and right: the gesture is sideways, and a vertical pair reads as a list.
const pair = switchPeopleNodes(2);
assert.ok(pair[0]!.x < 0 && pair[1]!.x > 0, 'left and right');
assert.deepEqual(
  pair.map((p) => p.y),
  [0, 0],
  'level with each other'
);

// Three or more start at the top and go clockwise, so the shape sits upright.
for (const n of [3, 4, 5, 6]) {
  const [first] = switchPeopleNodes(n);
  assert.ok(Math.abs(first!.x) < 1e-9, `${n}: first dot is centred`);
  assert.ok(first!.y < 0, `${n}: and sits at the top`);
}

// A square really is a square: four dots, each the same distance from the middle.
const square = switchPeopleNodes(4);
const radii = square.map((p) => Math.hypot(p.x, p.y));
for (const r of radii) assert.ok(Math.abs(r - radii[0]!) < 1e-9, 'regular polygon');

// The ring closes — the last edge comes back to the first person.
const hex = switchPeopleEdges(6);
const hexNodes = switchPeopleNodes(6);
assert.deepEqual(hex[5]!.to, hexNodes[0]!, 'the sixth hop returns to the first');

// Every arrowhead sits past halfway, clear of the dot it just left.
for (const n of [3, 4, 5, 6]) {
  for (const edge of switchPeopleEdges(n)) {
    const toHead = Math.hypot(edge.head.x - edge.from.x, edge.head.y - edge.from.y);
    const whole = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y);
    assert.ok(toHead > whole * 0.5, `${n}: head is past the midpoint`);
    assert.ok(toHead < whole, `${n}: and still on the line`);
  }
}

// Two people get two separate one-way lines. One line with a head at each end reads as a bug.
const twoEdges = switchPeopleEdges(2);
assert.ok(twoEdges[0]!.from.y !== twoEdges[1]!.from.y, 'offset above and below');
assert.ok(twoEdges[0]!.angle !== twoEdges[1]!.angle, 'and pointing opposite ways');

// Nothing escapes the drawable box, dots included.
for (const n of [2, 3, 4, 5, 6]) {
  const dot = switchDotRadius(n);
  for (const node of switchPeopleNodes(n)) {
    assert.ok(Math.abs(node.x) + dot <= 1, `${n}: dot fits across`);
    assert.ok(Math.abs(node.y) + dot <= 1, `${n}: dot fits down`);
  }
}
// More people, smaller dots — six on one ring cannot be drawn at three's size.
assert.ok(switchDotRadius(6) < switchDotRadius(3));

// Five or six heads inside a 22px ring fill its middle and the shape stops reading — which is
// how the old mark became a smudge. Big rings put a head on every other edge instead.
for (const n of [2, 3, 4]) {
  assert.ok(
    switchPeopleEdges(n).every((e) => e.showHead),
    `${n}: every hop is marked`
  );
}
for (const n of [5, 6]) {
  const heads = switchPeopleEdges(n).filter((e) => e.showHead).length;
  assert.ok(heads >= 2 && heads < n, `${n}: some hops marked, not all (got ${heads})`);
}

const bar = readFileSync('components/orbit/make-tab-bar.tsx', 'utf8');
assert.match(bar, /SwitchPeopleIcon count=\{switchPeopleCount\}/, 'the tab draws the ring');
const icon = readFileSync('components/orbit/switch-people-icon.tsx', 'utf8');
assert.match(icon, /switchPeopleNodes/, 'people are drawn');
assert.match(icon, /switchPeopleEdges/, 'and the hops between them');

const link = buildSharedDeviceInviteLink({
  label: 'Kitchen iPad',
  codes: ['cmx-maya', 'CMX-JACK'],
});
assert.match(link, /^choremaxx:\/\/shared-device\?/);
assert.match(link, /Kitchen/);
const parsed = parseSharedDeviceInvitePayload(link);
assert.ok(parsed);
assert.equal(parsed!.label, 'Kitchen iPad');
assert.deepEqual(parsed!.codes, ['CMX-MAYA', 'CMX-JACK']);

assert.equal(parseSharedDeviceInvitePayload('choremaxx://join/CMX-MAYA'), null);
assert.equal(parseSharedDeviceInvitePayload(''), null);

console.log('shared-device-invite: ok');
