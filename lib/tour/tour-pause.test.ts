/**
 * Tour action steps still advance while the overlay is paused.
 * Run: npx tsx lib/tour/tour-pause.test.ts
 */
import assert from 'node:assert/strict';

import { emitTourEvent } from '@/lib/tour/tour-events';
import {
  advanceAfterStep,
  bindTourStepAdvance,
  completeTourState,
  resolveActivePointer,
  retreatBeforeStep,
  shouldPauseTour,
  startTourState,
  tourCanRetreat,
  tourRouteMatches,
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
state = { ...state, chapterId: 'tasks', stepIndex: 1 }; // tasks.assign
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'tasks.assign');
assert.equal(resolveActivePointer(state, ctx)?.step.advance.kind, 'next');

// Assign is shown on a mock window now: the step after it is the demo, not a real form.
const afterAssign = advanceAfterStep(state, ctx);
const demo = resolveActivePointer(afterAssign, ctx);
assert.equal(demo?.step.id, 'tasks.assignDemo');
assert.equal(demo?.step.primaryAction, 'open_mock_assign');
assert.equal(resolveActivePointer(advanceAfterStep(afterAssign, ctx), ctx)?.step.id, 'tasks.hold');

// Poppins try step (after tab, mode, demo and silence)
state = { ...startTourState('admin'), chapterId: 'poppins', stepIndex: 4 };
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.try');

const backOne = retreatBeforeStep(state, ctx);
assert.equal(backOne.chapterId, 'poppins');
assert.equal(backOne.stepIndex, 3);
assert.equal(tourCanRetreat(state, ctx), true);
const first = startTourState('admin');
assert.equal(tourCanRetreat(first, ctx), false);
assert.equal(retreatBeforeStep(first, ctx).stepIndex, 0);

const atTasks = { ...startTourState('admin'), chapterId: 'tasks', stepIndex: 0 };
const backToHome = retreatBeforeStep(atTasks, ctx);
assert.equal(backToHome.chapterId, 'home');
assert.equal(backToHome.stepIndex, 2);
assert.equal(tourCanRetreat(atTasks, ctx), true);

const done = completeTourState(startTourState('admin'));
assert.equal(done.status, 'completed');
assert.equal(done.checklistHidden, true);

assert.equal(tourRouteMatches('/(tabs)/groceries', '/(tabs)'), false);
assert.equal(tourRouteMatches('/(tabs)', '/(tabs)'), true);
assert.equal(tourRouteMatches('/(tabs)/index', '/(tabs)'), true);
assert.equal(tourRouteMatches('/(tabs)/tasks', '/(tabs)/tasks'), true);
assert.equal(tourRouteMatches('/tasks', '/(tabs)/tasks'), true);
assert.equal(tourRouteMatches('/(tabs)', '/(tabs)/tasks'), false);

let paused = true;
state = { ...startTourState('admin'), chapterId: 'poppins', stepIndex: 4 };
const unsub = bindTourStepAdvance({
  state,
  ctx,
  onAdvance: (next) => {
    state = next;
  },
});

// try is a plain next step now: a spoken turn must not skip past it.
emitTourEvent('poppins_spoke');
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.try');
state = advanceAfterStep(state, ctx);
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.meter');
unsub();

console.log('tour-pause.test.ts ok');
