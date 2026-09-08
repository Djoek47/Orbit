/**
 * Poppins chore titles: catalog name or a close open list item, never the spoken sentence.
 * Run: npx tsx lib/poppins/catalog-match.test.ts
 */

import assert from 'node:assert/strict';

import { executePoppinsTool } from '@/lib/ai/execute-poppins-tool';
import {
  extractSpokenChoreTitle,
  matchLibraryIntent,
  resolvePoppinsChoreTitle,
} from '@/lib/poppins/catalog-match';
import { parseHouseholdIntent, rewriteAiuicActions } from '@/lib/poppins/ui-intent';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const garbled = "I'll set desk for to wash my car";
const spoken = "I'll set a task to wash car";

assert.equal(extractSpokenChoreTitle(garbled), 'wash my car');
assert.equal(extractSpokenChoreTitle(spoken), 'wash car');
assert.match(String(extractSpokenChoreTitle('tend to the dishes, assign it to me')), /tend/i);

const fromGarbled = resolvePoppinsChoreTitle(garbled);
assert.equal(fromGarbled.title, 'Wash the car');
assert.equal(fromGarbled.libraryTaskId, 'wash_the_car');
assert.equal(fromGarbled.category, 'car');

const fromSpoken = resolvePoppinsChoreTitle(spoken);
assert.equal(fromSpoken.title, 'Wash the car');
assert.equal(fromSpoken.libraryTaskId, 'wash_the_car');

const loadDish = resolvePoppinsChoreTitle('load the dishwasher for me tomorrow');
assert.equal(loadDish.title, 'Load the dishwasher');
assert.equal(loadDish.libraryTaskId, 'load_the_dishwasher');

const reused = resolvePoppinsChoreTitle(spoken, {
  existingTasks: [{ title: "Wash Josh's car", status: 'Pending' }],
});
assert.equal(reused.title, "Wash Josh's car");

const tend = resolvePoppinsChoreTitle('tend to the dishes, assign it to me');
assert.match(tend.title, /tend/i);
assert.equal(tend.libraryTaskId, undefined);

const kitchen = parseHouseholdIntent('Schedule a task for kitchen tomorrow');
assert.equal(kitchen[0]?.type, 'create_task_draft');
assert.ok(!kitchen[0]?.title, 'generic schedule-a-task must not fake a title');

const intent = parseHouseholdIntent(garbled);
assert.equal(intent[0]?.title, 'Wash the car');
assert.equal(intent[0]?.libraryTaskId, 'wash_the_car');

const kitchenRewrite = rewriteAiuicActions(
  [{ type: 'create_task_draft', title: 'Schedule a task for kitchen tomorrow' }],
  'Schedule a task for kitchen tomorrow'
);
assert.ok(!kitchenRewrite[0]?.title, 'rewrite must not keep the schedule sentence as a title');

const rewritten = rewriteAiuicActions(
  [{ type: 'create_task_draft', title: garbled }],
  garbled
);
assert.equal(rewritten[0]?.title, 'Wash the car');
assert.equal(rewritten[0]?.libraryTaskId, 'wash_the_car');

const playlist = mapUiActionsToPlaylist(rewritten);
assert.equal(playlist[0]?.payload.title, 'Wash the car');
assert.equal(playlist[0]?.payload.libraryTaskId, 'wash_the_car');

const household = {
  id: 'hh1',
  householdName: 'Test',
  greetingName: 'Alex',
  tasks: [{ id: 't1', title: 'Wash the car', status: 'Pending', assignee: 'Alex' }],
  groceries: [],
  events: [],
  members: [{ id: 'm1', name: 'Alex', role: 'admin', status: 'active' }],
  rewards: [],
  itineraries: [],
  places: [],
} as unknown as HouseholdSnapshot;

const metrics = {
  momentum: 50,
  openTasks: 1,
  taskCompletionRate: 1,
  groceryReadiness: 1,
  calendarCoverage: 1,
  upcomingEvents: 0,
} as unknown as OrbitMetrics;

const drafted = executePoppinsTool('create_task_draft', { title: garbled }, household, metrics);
const action = (drafted.ui_actions as Array<Record<string, unknown>>)[0];
assert.equal(action?.title, 'Wash the car');
assert.equal(action?.libraryTaskId, 'wash_the_car');

const car = matchLibraryIntent('wash my car');
assert.equal(car.task?.id, 'wash_the_car');

console.log('PASS catalog-match titles');
