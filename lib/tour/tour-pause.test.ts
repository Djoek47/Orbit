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
assert.equal(resolveActivePointer(state, ctx)?.step.advance.kind, 'action');

// Opening Assign must advance even if the overlay pointer is paused/hidden.
const afterAssignOpen = advanceAfterStep(state, ctx);
assert.equal(resolveActivePointer(afterAssignOpen, ctx)?.step.id, 'tasks.form');
assert.equal(resolveActivePointer(afterAssignOpen, ctx)?.step.advance.kind, 'event');

state = afterAssignOpen;
const unsubForm = bindTourStepAdvance({
  state,
  ctx,
  onAdvance: (next) => {
    state = next;
  },
});
emitTourEvent('task_created');
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'tasks.hold');
unsubForm();

// Poppins try step (mode card sits at index 1 after the itinerary tour pass)
state = { ...startTourState('admin'), chapterId: 'poppins', stepIndex: 2 };
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.try');

const backOne = retreatBeforeStep(state, ctx);
assert.equal(backOne.chapterId, 'poppins');
assert.equal(backOne.stepIndex, 1);
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
state = { ...startTourState('admin'), chapterId: 'poppins', stepIndex: 2 };
const unsub = bindTourStepAdvance({
  state,
  ctx,
  onAdvance: (next) => {
    state = next;
  },
});

emitTourEvent('poppins_spoke');
assert.notEqual(resolveActivePointer(state, ctx)?.step.id, 'poppins.try');
paused = false;
assert.equal(paused, false);
assert.equal(resolveActivePointer(state, ctx)?.step.id, 'poppins.silence');
assert.equal(resolveActivePointer(state, ctx)?.step.centered, true);
unsub();

console.log('tour-pause.test.ts ok');
