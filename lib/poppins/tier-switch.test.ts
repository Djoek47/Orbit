/**
 * WO15 §1.3 — Base ↔ Max preserves advanced keys.
 * Run: npx --yes tsx lib/poppins/tier-switch.test.ts
 */
import assert from 'node:assert/strict';

import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  poppinsTier,
  prefsForTier,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';

const tuned: PoppinsInteractionPrefs = {
  ...DEFAULT_POPPINS_INTERACTION_PREFS,
  speakBack: false,
  undoWindowSec: 15,
  confirmTime: 'relaxed',
  showThinking: false,
  writtenReplies: false,
  actImmediately: true,
};

{
  const toMax = prefsForTier('max', tuned);
  assert.equal(toMax.speakBack, true);
  assert.equal(toMax.undoWindowSec, 15);
  assert.equal(toMax.confirmTime, 'relaxed');
  assert.equal(toMax.showThinking, false);
  assert.equal(toMax.writtenReplies, false);
  assert.equal(toMax.actImmediately, true);
}

{
  const back = prefsForTier('base', prefsForTier('max', tuned));
  assert.equal(back.speakBack, false);
  assert.equal(back.undoWindowSec, 15);
  assert.equal(back.confirmTime, 'relaxed');
}

{
  assert.equal(poppinsTier(tuned), 'custom');
  assert.equal(poppinsTier(prefsForTier('base')), 'base');
  assert.equal(poppinsTier(prefsForTier('max')), 'max');
}

console.log('PASS tier-switch');
