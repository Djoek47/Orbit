/**
 * WO13 A5 — orb water / drain / amber.
 * Run: npx tsx lib/poppins/orb-levels.test.ts
 */
import assert from 'node:assert/strict';

import {
  TOKEN_WEIGHT_QUIET,
  TOKEN_WEIGHT_SPEAK_BACK,
  TOKENS_PER_DAY,
} from '@/constants/poppins-ai-rates';
import {
  ORB_AMBER_THRESHOLD,
  drainPreviewFill,
  turnActCost,
  waterFillFromDaily,
  waterIsAmber,
  waterIsEmpty,
} from '@/lib/poppins/orb-levels';

assert.equal(waterFillFromDaily(TOKENS_PER_DAY), 1);
assert.equal(waterFillFromDaily(0), 0);
assert.ok(Math.abs(waterFillFromDaily(TOKENS_PER_DAY / 2) - 0.5) < 1e-9);

const full = 1;
const baseDrain = drainPreviewFill(full, TOKEN_WEIGHT_QUIET, TOKENS_PER_DAY);
assert.ok(
  Math.abs(baseDrain - (1 - TOKEN_WEIGHT_QUIET / TOKENS_PER_DAY)) < 1e-9,
  `base drain ${baseDrain}`
);

const maxDrain = drainPreviewFill(full, TOKEN_WEIGHT_SPEAK_BACK, TOKENS_PER_DAY);
assert.ok(
  Math.abs(maxDrain - (1 - TOKEN_WEIGHT_SPEAK_BACK / TOKENS_PER_DAY)) < 1e-9,
  `max drain ${maxDrain}`
);

assert.equal(drainPreviewFill(0.01, TOKEN_WEIGHT_SPEAK_BACK, TOKENS_PER_DAY), 0);

assert.equal(turnActCost('silent'), TOKEN_WEIGHT_QUIET);
assert.equal(turnActCost('spoken'), TOKEN_WEIGHT_SPEAK_BACK);
// Grouped three-item card still one act
assert.equal(turnActCost('silent', 3), TOKEN_WEIGHT_QUIET);
assert.equal(turnActCost('spoken', 3), TOKEN_WEIGHT_SPEAK_BACK);

assert.equal(waterIsAmber(ORB_AMBER_THRESHOLD - 0.01), true);
assert.equal(waterIsAmber(ORB_AMBER_THRESHOLD), false);
assert.equal(waterIsAmber(0.5), false);
assert.equal(waterIsEmpty(0), true);
assert.equal(waterIsEmpty(0.01), false);

console.log('orb-levels.test.ts ok', {
  baseDrain: baseDrain.toFixed(4),
  maxDrain: maxDrain.toFixed(4),
});
