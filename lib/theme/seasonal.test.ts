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
