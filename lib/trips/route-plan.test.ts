import assert from 'node:assert/strict';

import {
  estimateDriveMinutes,
  haversineKm,
  kmSaved,
  optimizeOrder,
  pathKm,
} from './route-plan';

// Haversine: Montréal → Québec City ≈ 233 km; 1° latitude ≈ 111.2 km.
const mtl = { lat: 45.5017, lng: -73.5673 };
const qc = { lat: 46.8139, lng: -71.208 };
const d = haversineKm(mtl, qc);
assert.ok(d > 225 && d < 240, `mtl-qc ${d}`);
assert.ok(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111.19) < 0.1);
assert.equal(haversineKm(mtl, mtl), 0);

// Crafted zig-zag on a line: home at 0, stops at 3,1,4,2 (km-ish along latitude).
const deg = 1 / 111.19;
const home = { lat: 0, lng: 0 };
const at = (n: number) => ({ id: n, lat: n * deg, lng: 0 });
const zig = [at(3), at(1), at(4), at(2)];
const before = pathKm(zig, home);
assert.ok(Math.abs(before - 10) < 0.05, `before ${before}`); // 3+2+3+2
const shortest = optimizeOrder(zig, 'shortest', home);
assert.deepEqual(shortest.map((s) => s.id), [1, 2, 3, 4]);
const after = pathKm(shortest, home);
assert.ok(Math.abs(after - 4) < 0.05);
assert.equal(kmSaved(before, after), 6);

// 2-opt beats plain nearest-neighbour on a crossing case (no home: first stop is fixed).
const sq = [
  { id: 'a', lat: 0, lng: 0 },
  { id: 'c', lat: 0.01, lng: 0.01 },
  { id: 'b', lat: 0, lng: 0.01 },
  { id: 'd', lat: 0.01, lng: 0 },
];
const sqBefore = pathKm(sq);
const sqOpt = optimizeOrder(sq, 'shortest');
assert.equal(sqOpt[0]!.id, 'a');
assert.ok(pathKm(sqOpt) < sqBefore - 0.5, 'crossing removed');

// Round trip: closed loop back home.
const loop = optimizeOrder(zig, 'round-trip', home);
const loopKm = pathKm(loop, home, home);
assert.ok(Math.abs(loopKm - 8) < 0.05, `loop ${loopKm}`); // out to 4 and back
assert.ok(loopKm <= pathKm(zig, home, home));

// Stops without coordinates are kept, appended.
const mixed = optimizeOrder([at(2), { id: 99 } as { id: number; lat?: number; lng?: number }, at(1)], 'shortest', home);
assert.deepEqual(mixed.map((s) => s.id), [1, 2, 99]);

// Drive estimate: 15 km @30 km/h = 30 min + 2 stops*5.
assert.equal(estimateDriveMinutes(15, 2), 40);
assert.equal(kmSaved(3, 5), 0);

console.log('route-plan: all tests passed');
