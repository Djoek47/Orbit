/**
 * Tour action steps still advance while the overlay is paused.
 * Run: npx tsx lib/tour/tour-pause.test.ts
 */
import assert from 'node:assert/strict';

import { emitTourEvent } from '@/lib/tour/tour-events';
import {
  bindTourStepAdvance,
  resolveActivePointer,
  shouldPauseTour,
  startTourState,
} from '@/lib/tour/tour-store';
import type { TourConditionContext } from '@/lib/tour/tour-conditions';
import type { HouseholdSnapshot } from '@/types/orbit';

const ctx: TourConditionContext = {
  household: {
    id: 'hh-tour',
    tasks: [],
    members: [],
    rewardModel: 'xp_rewards',
  } as unknown as HouseholdSnapshot,
};

assert.equal(
  shouldPauseTour({ actionStep: true, stageLive: true, keyboardVisible: true }),
  false,
  'action steps do not pause for the stage or keyboard'
);
assert.equal(
  shouldPauseTour({ actionStep: false, stageLive: true, keyboardVisible: false }),
  true
);

let state = startTourState('admin');
state = { ...state, chapterId: 'poppins', stepIndex: 1 };
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.try');

let paused = true;
const unsub = bindTourStepAdvance({
  state,
  ctx,
  onAdvance: (next) => {
    state = next;
  },
});

emitTourEvent('poppins_act_committed');
assert.notEqual(resolveActivePointer(state, ctx)?.step.id, 'poppins.try');
paused = false;
assert.equal(paused, false);
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.silence');
assert.equal(resolveActivePointer(state, ctx)?.step.centered, true);
unsub();

console.log('tour-pause.test.ts ok');
