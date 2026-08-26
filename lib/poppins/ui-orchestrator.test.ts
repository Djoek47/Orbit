import assert from 'node:assert/strict';

import { executePoppinsTool } from '@/lib/ai/execute-poppins-tool';
import { POPPINS_TOOL_DEFINITIONS } from '@/lib/ai/poppins-tools';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { hearAndDrive } from '@/lib/poppins/aiuic';
import { HOLD_MS_DEFAULT, HOLD_MS_KID, isCoachRoute } from '@/lib/poppins/ui-scenes';
import { interpretStageSpeech } from '@/lib/poppins/ui-speech';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const household = {
  id: 'hh1',
  householdName: 'Test House',
  greetingName: 'Alex',
  tasks: [
    {
      id: 't1',
      title: 'Dishes',
      assignee: 'Sam',
      due: 'Overdue',
      status: 'Overdue',
      category: 'Kitchen',
      xp: 10,
    },
  ],
  groceries: [{ id: 'g1', name: 'Milk', category: 'Dairy', status: 'Missing' }],
  events: [],
  members: [
    { id: 'm1', name: 'Alex', role: 'admin', status: 'active', weekXp: 10 },
    { id: 'm2', name: 'Maya', role: 'child', status: 'active', weekXp: 4 },
  ],
  rewards: [],
} as unknown as HouseholdSnapshot;

const metrics = { momentum: 50, openTasks: 1 } as OrbitMetrics;

poppinsUiOrchestrator.clear();

const taskPlaylist = mapUiActionsToPlaylist([
  { type: 'create_task_draft', title: 'Dishwasher', assignee: 'Alex', due: 'Tomorrow' },
]);
assert.equal(taskPlaylist[0]?.scene, 'task_compose');
assert.equal(taskPlaylist[0]?.commit, 'hold');
assert.equal(taskPlaylist[0]?.payload.write, 'create_task');
assert.equal(taskPlaylist[0]?.payload.assignee, 'Alex');
assert.equal(taskPlaylist[0]?.payload.composeReady, true);
assert.equal(taskPlaylist[0]?.payload.composeStep, 'ready');
assert.equal(taskPlaylist.some((beat) => beat.scene === 'result_mark'), true);

const navCreate = mapUiActionsToPlaylist([{ type: 'navigate', route: '/create-task' }]);
assert.equal(navCreate[0]?.scene, 'task_compose');
assert.equal(navCreate[0]?.commit, 'hold');
const navAssign = mapUiActionsToPlaylist([{ type: 'navigate', route: '/assign-task' }]);
assert.equal(navAssign[0]?.scene, 'task_compose');
const navAssignSelf = mapUiActionsToPlaylist([
  { type: 'navigate', route: '/assign-task', openEditor: true },
]);
assert.equal(navAssignSelf[0]?.scene, 'navigate_coach');
assert.equal(navAssignSelf[0]?.payload.route, '/assign-task');

const settings = mapUiActionsToPlaylist([{ type: 'navigate', route: '/settings' }]);
assert.equal(settings[0]?.scene, 'navigate_coach');
assert.equal(settings[0]?.commit, 'none');
assert.equal(isCoachRoute('/settings'), true);

const reward = mapUiActionsToPlaylist([{ type: 'claim_reward', rewardName: 'Movie night' }]);
assert.equal(reward[0]?.scene, 'reward_mint');
assert.equal(reward[0]?.commit, 'confirm');
assert.notEqual(reward[0]?.commit, 'hold');

const invalidScene = mapUiActionsToPlaylist([
  { type: 'present_ui_scene', scene: 'invented_widget' },
]);
assert.equal(invalidScene[0]?.scene, 'thinking');

const chain = mapUiActionsToPlaylist([
  { type: 'create_itinerary', title: 'Store' },
  { type: 'create_calendar_event', title: 'Dentist', date: '2026-08-14' },
]);
assert.equal(chain[0]?.scene, 'itinerary_stage');
assert.equal(chain[0]?.commit, 'hold');
assert.equal(chain[1]?.scene, 'calendar_zoom');
assert.equal(chain[1]?.commit, 'hold');

const drafted = executePoppinsTool(
  'create_task_draft',
  { title: 'Dishwasher', assignee: 'Alex', due: 'Tomorrow' },
  household,
  metrics
);
const draftedActions = drafted.ui_actions as Array<Record<string, unknown>>;
assert.equal(draftedActions[0]?.type, 'create_task_draft');
assert.ok(!JSON.stringify(drafted).includes('/create-task'));

const evented = executePoppinsTool(
  'create_calendar_event',
  { title: 'Dentist', date: '2026-08-14' },
  household,
  metrics
);
assert.equal((evented.ui_actions as Array<Record<string, unknown>>)[0]?.type, 'create_calendar_event');

const coached = executePoppinsTool('navigate_to', { route: '/settings' }, household, metrics);
assert.equal((coached.ui_actions as Array<Record<string, unknown>>)[0]?.route, '/settings');

const scene = executePoppinsTool('present_ui_scene', { scene: 'task_compose' }, household, metrics);
assert.equal((scene.ui_actions as Array<Record<string, unknown>>)[0]?.scene, 'task_compose');

const badScene = executePoppinsTool('present_ui_scene', { scene: 'freeform_jsx' }, household, metrics);
assert.equal(badScene.error, 'unknown_scene');

assert.ok(POPPINS_TOOL_DEFINITIONS.some((tool) => tool.name === 'present_ui_scene'));
assert.ok(POPPINS_TOOL_DEFINITIONS.some((tool) => tool.name === 'remember_house_fact'));

const remembered = executePoppinsTool(
  'remember_house_fact',
  { kind: 'dislike', subject: 'Liam', text: 'Liam should not be assigned dishes' },
  household,
  metrics
);
assert.equal(remembered.remembered, true);
assert.equal((remembered.ui_actions as Array<Record<string, unknown>>)[0]?.type, 'remember_house_fact');

const privateFact = executePoppinsTool(
  'remember_house_fact',
  { kind: 'note', subject: 'house', text: 'his medical diagnosis is private' },
  household,
  metrics
);
assert.ok(Array.isArray(privateFact.pending_confirmations), 'privacy-sensitive facts confirm');

const intent = parseHouseholdIntent('Add a dishwasher task for Alex');
assert.equal(intent[0]?.type, 'create_task_draft');
assert.equal(intent[0]?.assignee, 'Alex');
assert.match(String(intent[0]?.title), /dishwasher/i);

const dishes = parseHouseholdIntent('I want to clean dishes');
assert.equal(dishes[0]?.type, 'create_task_draft');
assert.equal(dishes[0]?.category, 'kitchen_dining');
assert.ok(!JSON.stringify(dishes).includes('I can open that'));

const openSelf = parseHouseholdIntent('Open it so I can assign it myself');
assert.equal(openSelf[0]?.type, 'navigate');
assert.equal(openSelf[0]?.route, '/assign-task');
assert.equal(openSelf[0]?.openEditor, true);

const milk = parseHouseholdIntent('Add milk to the list');
assert.equal(milk[0]?.type, 'add_grocery');
assert.match(String(milk[0]?.name), /milk/i);

const jordan = parseHouseholdIntent('Add the new Jordan 1 that is releasing in two weeks');
assert.equal(jordan[0]?.type, 'add_grocery');
assert.equal(jordan[0]?.lane, 'clothing');
assert.equal(jordan[1]?.type, 'create_calendar_event');

const done = parseHouseholdIntent("I've done the dishes");
assert.equal(done[0]?.type, 'complete_task');

const coachedAway = executePoppinsTool(
  'navigate_to',
  { route: '/assign-task' },
  household,
  metrics
);
assert.equal((coachedAway.ui_actions as Array<Record<string, unknown>>)[0]?.type, 'create_task_draft');

const compound = parseHouseholdIntent(
  'Add a store to the itinerary then add a dentist appointment'
);
assert.equal(compound[0]?.type, 'create_itinerary');
assert.equal(compound[1]?.type, 'create_calendar_event');
assert.equal(compound[1]?.title, 'Dentist');

const settingsIntent = parseHouseholdIntent('Open settings');
assert.equal(settingsIntent[0]?.type, 'navigate');
assert.equal(settingsIntent[0]?.route, '/settings');

const steer = interpretStageSpeech('Not Alex, Maya', {
  memberNames: ['Alex', 'Maya'],
  live: true,
});
assert.equal(steer.kind, 'revise');
if (steer.kind === 'revise') assert.equal(steer.patch.assignee, 'Maya');

assert.equal(interpretStageSpeech('wait').kind, 'freeze');
assert.equal(interpretStageSpeech('no').kind, 'veto');
assert.equal(interpretStageSpeech('yes').kind, 'confirm');

assert.equal(HOLD_MS_DEFAULT, 850);

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
hearAndDrive('Add a dishwasher task for Alex', ['Alex', 'Maya']);
assert.equal(poppinsUiOrchestrator.getState().live, true);
assert.match(poppinsUiOrchestrator.getState().spoken, /dishwasher/i);
assert.equal(poppinsUiOrchestrator.getState().phase, 'unfold', 'named beat skips SHOW wait');
const genieId = poppinsUiOrchestrator.getState().playlist[0]?.id;
hearAndDrive('Add a dishwasher task for Alex tomorrow', ['Alex', 'Maya']);
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.id, genieId, 'partials merge, do not restart');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.due, 'Tomorrow');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.assignee, 'Alex');

poppinsUiOrchestrator.drive(
  [{ type: 'create_task_draft', title: 'Dishwasher', assignee: 'Alex' }],
  { replace: true }
);
assert.equal(poppinsUiOrchestrator.getState().live, true);
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.scene, 'task_compose');
poppinsUiOrchestrator.revise({ assignee: 'Maya' });
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.assignee, 'Maya');
assert.equal(poppinsUiOrchestrator.getState().frozen, false);

poppinsUiOrchestrator.drive([{ type: 'create_calendar_event', title: 'Dentist' }]);
assert.ok(poppinsUiOrchestrator.getState().playlist.some((beat) => beat.scene === 'calendar_zoom'));

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.drive([{ type: 'claim_reward', rewardName: 'Ice cream' }], { kid: true });
assert.equal(poppinsUiOrchestrator.getState().live, false);

poppinsUiOrchestrator.drive(
  [{ type: 'create_task_draft', title: 'Tidy' }],
  { kid: true, replace: true }
);
assert.equal(poppinsUiOrchestrator.getState().holdMs, HOLD_MS_KID);
poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);

const complete = mapUiActionsToPlaylist([{ type: 'complete_task', taskId: 't1', title: 'Dishes' }]);
assert.equal(complete[0]?.scene, 'task_done');
assert.equal(complete[0]?.commit, 'hold');
assert.equal(complete[0]?.payload.write, 'complete_task');

const settingsHold = mapUiActionsToPlaylist([
  {
    type: 'present_ui_scene',
    scene: 'navigate_coach',
    commit: 'hold',
    payload: { route: '/settings', coachLine: 'Opening Settings.' },
  },
]);
assert.equal(settingsHold[0]?.commit, 'none');
assert.equal(settingsHold[0]?.scene, 'navigate_coach');

const settingsViaRoute = mapUiActionsToPlaylist([
  {
    type: 'present_ui_scene',
    scene: 'task_compose',
    commit: 'hold',
    payload: { route: '/settings', title: 'Nope' },
  },
]);
assert.equal(settingsViaRoute[0]?.commit, 'none');

poppinsUiOrchestrator.setSpeaking(true);
poppinsUiOrchestrator.drive(
  [{ type: 'create_task_draft', title: 'Dishwasher', assignee: 'Alex' }],
  { replace: true }
);
assert.equal(poppinsUiOrchestrator.getState().speaking, true);
assert.equal(poppinsUiOrchestrator.getState().holding, false);
assert.notEqual(poppinsUiOrchestrator.getState().phase, 'hold');

poppinsUiOrchestrator.syncSpoken('I will add the dishwasher for Alex', ['Alex', 'Maya']);
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.assignee, 'Alex');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.spokenName, 'Alex');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.scene, 'task_compose');
assert.equal(poppinsUiOrchestrator.getState().holding, false);

poppinsUiOrchestrator.revise({ assignee: 'Maya' });
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.assignee, 'Maya');
assert.equal(poppinsUiOrchestrator.getState().holding, false);

poppinsUiOrchestrator.setSpeaking(false);
assert.equal(poppinsUiOrchestrator.getState().holding, false);

const steeredMaya = interpretStageSpeech('Maya', { memberNames: ['Alex', 'Maya'], live: true });
assert.equal(steeredMaya.kind, 'revise');
if (steeredMaya.kind === 'revise') assert.equal(steeredMaya.patch.assignee, 'Maya');

const kitchenSteer = interpretStageSpeech('kitchen', { live: true });
assert.equal(kitchenSteer.kind, 'revise');
if (kitchenSteer.kind === 'revise') assert.equal(kitchenSteer.patch.category, 'kitchen_dining');

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
poppinsUiOrchestrator.drive(
  [{ type: 'create_task_draft', title: 'Dishwasher', assignee: 'Alex' }],
  { replace: true }
);
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.composeReady, false);
poppinsUiOrchestrator.revise({
  category: 'kitchen_dining',
  selectedChipId: 'kitchen_dining',
  libraryTaskId: 'load_the_dishwasher',
  title: 'Load the dishwasher',
  due: 'Today',
  assignee: 'Alex',
});
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.composeReady, true);
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.composeStep, 'ready');

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);

poppinsUiOrchestrator.drive(
  [{ type: 'create_task_draft', title: 'Dishwasher', assignee: 'Maya' }],
  { replace: true }
);
poppinsUiOrchestrator.pause();
assert.equal(poppinsUiOrchestrator.getState().live, true, 'hangup keeps the act');
assert.equal(poppinsUiOrchestrator.getState().frozen, true, 'hangup freezes');
assert.equal(poppinsUiOrchestrator.getState().holding, false, 'clock stops');
const frozen = poppinsUiOrchestrator.snapshot();
poppinsUiOrchestrator.clear();
assert.equal(poppinsUiOrchestrator.getState().live, false);
poppinsUiOrchestrator.restore(frozen, { resumeHold: true });
assert.equal(poppinsUiOrchestrator.getState().live, true, 'Speak restores');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.title, 'Dishwasher');
assert.equal(poppinsUiOrchestrator.getState().frozen, false, 'return unfreezes');

poppinsUiOrchestrator.restore(frozen);
assert.equal(poppinsUiOrchestrator.getState().frozen, true, 'tab return stays frozen');
poppinsUiOrchestrator.unfreeze();
assert.equal(poppinsUiOrchestrator.getState().frozen, false, 'listening unfreezes');

assert.equal(isCoachRoute('/delete-account'), true);
assert.equal(isCoachRoute('/premium'), true);

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
poppinsUiOrchestrator.setCommitHandler(async () => {
  throw new Error('network');
});
poppinsUiOrchestrator.drive(
  [{ type: 'create_task_draft', title: 'Trash', assignee: 'Alex', due: 'Today' }],
  { replace: true }
);
void poppinsUiOrchestrator.confirm().then(() => {
  assert.equal(poppinsUiOrchestrator.getState().live, true, 'failed commit keeps the act');
  assert.equal(poppinsUiOrchestrator.getState().frozen, true, 'failed commit freezes');
  assert.match(poppinsUiOrchestrator.getState().thinkingLine, /try again/i);
  poppinsUiOrchestrator.setCommitHandler(null);
  poppinsUiOrchestrator.clear();
  console.log('iui orchestrator tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
