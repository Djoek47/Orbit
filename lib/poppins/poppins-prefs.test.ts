/**
 * Settings path updates session getters and subscribers without a remount.
 * Run: npx tsx lib/poppins/poppins-prefs.test.ts
 */
import assert from 'node:assert/strict';

import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  getPoppinsPrefs,
  poppinsTier,
  prefsForTier,
  savePoppinsInteractionPrefs,
  subscribePoppinsPrefs,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';
import {
  getSessionActMode,
  getSessionDirectMode,
  getSessionHoldMultiplier,
  getSessionNotificationActions,
  getSessionShowThinking,
  getSessionUndoMs,
  getSessionWrittenReplies,
} from '@/lib/poppins/session-act-mode';

const householdId = 'hh-prefs-live';

const tabState: PoppinsInteractionPrefs[] = [];
const unsubscribe = subscribePoppinsPrefs(householdId, (prefs) => {
  tabState.push(prefs);
});

async function apply(patch: Partial<PoppinsInteractionPrefs>) {
  const next = { ...DEFAULT_POPPINS_INTERACTION_PREFS, ...patch };
  await savePoppinsInteractionPrefs(householdId, next);
  return next;
}

async function main() {
assert.equal(poppinsTier(DEFAULT_POPPINS_INTERACTION_PREFS), 'base');
assert.equal(poppinsTier(prefsForTier('max')), 'max');
assert.equal(prefsForTier('base').speakBack, false);
assert.equal(prefsForTier('max').speakBack, true);
assert.equal(prefsForTier('max').undoWindowSec, 5);
assert.equal(
  poppinsTier({ ...DEFAULT_POPPINS_INTERACTION_PREFS, showThinking: false }),
  'custom'
);
assert.equal(
  poppinsTier({ ...prefsForTier('max'), actImmediately: true }),
  'custom'
);

await apply({ speakBack: true });
assert.equal(getSessionActMode(), 'spoken');
assert.equal(getPoppinsPrefs(householdId).speakBack, true);
assert.equal(tabState.at(-1)?.speakBack, true);

await apply({ speakBack: false, actImmediately: true });
assert.equal(getSessionActMode(), 'silent');
assert.equal(getSessionDirectMode(), true);
assert.equal(tabState.at(-1)?.actImmediately, true);

await apply({ confirmTime: 'relaxed' });
assert.equal(getSessionHoldMultiplier(), 1.4);
assert.equal(tabState.at(-1)?.confirmTime, 'relaxed');

await apply({ undoWindowSec: 15 });
assert.equal(getSessionUndoMs(), 15000);
assert.equal(tabState.at(-1)?.undoWindowSec, 15);

await apply({ showThinking: false });
assert.equal(getSessionShowThinking(), false);
assert.equal(tabState.at(-1)?.showThinking, false);

await apply({ writtenReplies: false });
assert.equal(getSessionWrittenReplies(), false);
assert.equal(tabState.at(-1)?.writtenReplies, false);

await apply({ notificationActions: false });
assert.equal(getSessionNotificationActions(), false);
assert.equal(tabState.at(-1)?.notificationActions, false);

assert.ok(tabState.length >= 7, 'subscriber updated without remount');
unsubscribe();
console.log('poppins-prefs.test.ts ok');
}

void main();
