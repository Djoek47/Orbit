import assert from 'node:assert/strict';

import { MOJI_ART } from '@/components/orbit/moji/art';
import {
  daysUntilHalloween,
  HALLOWEEN_MONSTER,
  HALLOWEEN_RELEASED,
  halloweenAvailable,
  halloweenPalette,
  halloweenWindow,
} from './seasonal';

// Classic build: the season never shows until the flag flips.
assert.equal(HALLOWEEN_RELEASED, false, 'Halloween ships off in the classic build');
assert.equal(halloweenAvailable(new Date(2026, 9, 20)), false);
// With the flag: October only.
assert.equal(halloweenAvailable(new Date(2026, 9, 1), true), true);
assert.equal(halloweenAvailable(new Date(2026, 9, 31, 23, 59), true), true);
assert.equal(halloweenAvailable(new Date(2026, 10, 1, 0, 0), true), false);
assert.equal(halloweenWindow(new Date(2026, 8, 30)), false);
assert.equal(daysUntilHalloween(new Date(2026, 9, 13)), 18);
assert.equal(daysUntilHalloween(new Date(2026, 9, 31)), 0);
// Every color has a drawn monster.
for (const [id, m] of Object.entries(HALLOWEEN_MONSTER)) assert.ok(MOJI_ART[m.moji], id);
// The overlay keeps semantic colors and forces night.
const base = { primary: '#D85A30', success: '#34D399', isDark: false, background: '#fff' } as never;
const night = halloweenPalette(base, 'coral') as unknown as Record<string, unknown>;
assert.equal(night.isDark, true);
assert.equal(night.success, '#34D399');
assert.notEqual(night.background, '#fff');
console.log('seasonal — ok');

// ── Thanksgiving and Christmas ──────────────────────────────────────────────────────────
import {
  christmasWindow,
  currentSeason,
  daysUntil,
  SEASON_MASCOT,
  seasonAvailable,
  seasonPalette,
  thanksgivingWindow,
  usThanksgiving,
} from './seasonal';

// Fourth Thursday of November.
assert.equal(usThanksgiving(2026).getDate(), 26);
assert.equal(usThanksgiving(2027).getDate(), 25);
assert.equal(usThanksgiving(2028).getDate(), 23);
assert.equal(usThanksgiving(2026).getDay(), 4);
// Thanksgiving: Nov 1 up to the Monday after.
assert.equal(thanksgivingWindow(new Date(2026, 9, 31, 23, 59)), false);
assert.equal(thanksgivingWindow(new Date(2026, 10, 1)), true);
assert.equal(thanksgivingWindow(new Date(2026, 10, 29, 23, 59)), true);
assert.equal(thanksgivingWindow(new Date(2026, 10, 30)), false);
// Christmas picks up that Monday and runs to Jan 7.
assert.equal(christmasWindow(new Date(2026, 10, 29)), false);
assert.equal(christmasWindow(new Date(2026, 10, 30)), true);
assert.equal(christmasWindow(new Date(2026, 11, 25)), true);
assert.equal(christmasWindow(new Date(2027, 0, 6, 23, 59)), true);
assert.equal(christmasWindow(new Date(2027, 0, 7)), false);
assert.equal(christmasWindow(new Date(2027, 6, 1)), false);
// Never two seasons at once, across a whole year.
for (let d = new Date(2026, 0, 1); d < new Date(2027, 0, 1); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
  const n = [
    seasonAvailable('halloween', d, true),
    seasonAvailable('thanksgiving', d, true),
    seasonAvailable('christmas', d, true),
  ].filter(Boolean).length;
  assert.ok(n <= 1, d.toDateString());
}
assert.equal(currentSeason(new Date(2026, 10, 2)), 'thanksgiving');
assert.equal(currentSeason(new Date(2026, 11, 2)), 'christmas');
assert.equal(currentSeason(new Date(2026, 5, 2)), null);
assert.equal(daysUntil('thanksgiving', new Date(2026, 10, 2)), 24);
assert.equal(daysUntil('christmas', new Date(2026, 11, 24)), 1);
// Every color has a drawn character in every season.
for (const season of Object.values(SEASON_MASCOT)) {
  for (const [id, m] of Object.entries(season)) assert.ok(MOJI_ART[m.moji], `${id}: ${m.moji}`);
}
for (const s of ['thanksgiving', 'christmas'] as const) {
  const p = seasonPalette(base, 'coral', s) as unknown as Record<string, unknown>;
  assert.equal(p.isDark, true);
  assert.equal(p.success, '#34D399');
}
console.log('seasonal ok');
