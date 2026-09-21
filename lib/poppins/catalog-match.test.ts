/**
 * Poppins chore titles: catalog name or a close open list item, never the spoken sentence.
 * Run: npx tsx lib/poppins/catalog-match.test.ts
 */

import assert from 'node:assert/strict';

import { executePoppinsTool } from '@/lib/ai/execute-poppins-tool';
import {
  extractItemName,
  extractSpokenChoreTitle,
  isGroceryAddIntent,
  matchAssigneeName,
  matchGroceryCatalog,
  matchLibraryIntent,
  resolvePoppinsChoreTitle,
} from '@/lib/poppins/catalog-match';
import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { parseHouseholdIntent, rewriteAiuicActions } from '@/lib/poppins/ui-intent';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import { validateAct } from '@/lib/poppins/validate-act';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const garbled = "I'll set desk for to wash my car";
const spoken = "I'll set a task to wash car";

assert.match(String(extractSpokenChoreTitle(garbled)), /wash.*car/i);
assert.match(String(extractSpokenChoreTitle(spoken)), /wash.*car/i);
assert.match(String(extractSpokenChoreTitle('tend to the dishes, assign it to me')), /tend/i);

// Additive extract — WO A3 cases (no debris titles)
assert.match(
  String(extractSpokenChoreTitle('add me a cleaning task for dishes')),
  /clean.*dishes/i
);
assert.match(
  String(extractSpokenChoreTitle('add a cleaning task for dishes')),
  /clean.*dishes|dishes/i
);
assert.match(
  String(extractSpokenChoreTitle('create a task to clean the dishes')),
  /clean.*dishes/i
);
assert.equal(extractSpokenChoreTitle('dishes for Drako tomorrow'), undefined);
assert.match(
  String(extractSpokenChoreTitle('add me a quick cleaning task for the dishes tomorrow')),
  /clean.*dishes|dishes/i
);

// A3b — grocery extract additive + on/onto list
assert.equal(extractItemName('add milk to the list'), 'milk');
assert.equal(extractItemName('add milk on the list'), 'milk');
assert.equal(extractItemName('put eggs on the shopping list'), 'eggs');
assert.equal(extractItemName('can you add bread to the grocery list'), 'bread');
assert.equal(
  extractItemName('add go to store on the list'),
  undefined,
  'do not ship debris phrases as item names'
);
assert.equal(extractItemName('we need milk'), 'milk');
assert.equal(extractItemName("we're out of eggs"), 'eggs');
assert.equal(extractItemName('we are low on coffee'), 'coffee');
assert.equal(extractItemName('ran out of paper towels'), 'paper towels');

// --- WO9 A4: groceries never ask who ---
assert.ok(matchGroceryCatalog('bananas')?.confident);
assert.ok(matchGroceryCatalog('banana')?.confident);
assert.ok(matchGroceryCatalog('dish soap')?.confident);
assert.equal(matchGroceryCatalog('Maya', { excludeNames: ['Maya'] }), null);

assert.equal(isGroceryAddIntent('add bananas'), true);
assert.equal(isGroceryAddIntent('buy dish soap'), true);
assert.equal(isGroceryAddIntent('we need milk'), true);
assert.equal(isGroceryAddIntent("we're out of eggs and bread"), true);
assert.equal(isGroceryAddIntent('add toilet paper to the list'), true);
assert.equal(isGroceryAddIntent('add a task to buy milk'), false);
assert.equal(isGroceryAddIntent('Drako, buy milk on the way home'), false);
assert.equal(isGroceryAddIntent('add Maya'), false);

{
  const bananas = parseHouseholdIntent('add bananas');
  assert.equal(bananas[0]?.type, 'add_grocery');
  assert.ok(!bananas[0]?.assignee);
  const playlist = mapUiActionsToPlaylist(bananas);
  assert.equal(playlist[0]?.scene, 'grocery_add');
  assert.ok(!playlist[0]?.payload.assignee);
  assert.ok(!playlist[0]?.payload.faces);
}

{
  const need = parseHouseholdIntent('we need milk');
  assert.equal(need[0]?.type, 'add_grocery');
}

{
  const out = parseCompoundHouseholdIntent("we're out of eggs and bread");
  const groceries = out.filter((a) => String(a.type) === 'add_grocery');
  assert.equal(groceries.length, 1, `expected one grocery act, got ${JSON.stringify(out)}`);
  assert.match(String(groceries[0]?.name ?? ''), /eggs/i);
  assert.match(String(groceries[0]?.name ?? ''), /bread/i);
}

{
  const task = parseHouseholdIntent('add a task to buy milk');
  assert.equal(task[0]?.type, 'create_task_draft');
}

{
  const errand = parseHouseholdIntent('Drako, buy milk on the way home', {
    memberNames: ['Drako', 'Maya'],
  });
  assert.equal(errand[0]?.type, 'create_task_draft');
  assert.equal(errand[0]?.assignee, 'Drako');
}

{
  const modelPath = mapUiActionsToPlaylist([
    { type: 'create_task_draft', title: 'Bananas' },
  ]);
  assert.equal(modelPath[0]?.scene, 'grocery_add');
  assert.ok(!modelPath[0]?.payload.assignee);
  assert.match(String(modelPath[0]?.payload.groceryName ?? ''), /banana/i);
}

{
  const mixed = parseCompoundHouseholdIntent('dishes for Drako and add milk', {
    memberNames: ['Drako', 'Maya'],
  });
  const drafts = mixed.filter((a) => String(a.type) === 'create_task_draft');
  const groceries = mixed.filter((a) => String(a.type) === 'add_grocery');
  assert.ok(drafts.length >= 1);
  assert.equal(drafts[0]?.assignee, 'Drako');
  assert.equal(groceries.length, 1);
  assert.ok(!groceries[0]?.assignee);
  assert.notEqual(String(groceries[0]?.category ?? ''), 'kitchen_dining');
  const playlist = mapUiActionsToPlaylist(mixed);
  const groceryBeat = playlist.find((b) => b.scene === 'grocery_add');
  assert.ok(groceryBeat);
  assert.ok(!groceryBeat?.payload.assignee);
  assert.notEqual(String(groceryBeat?.payload.aisle ?? ''), 'kitchen_dining');
  // Dairy aisle from classifier, not chore domain
  assert.match(String(groceryBeat?.payload.aisle ?? ''), /dairy|milk|refrigerat/i);
}

{
  const mixed2 = parseCompoundHouseholdIntent('add milk and dishes for Drako', {
    memberNames: ['Drako', 'Maya'],
  });
  const groceries = mixed2.filter((a) => String(a.type) === 'add_grocery');
  assert.equal(groceries.length, 1);
  assert.ok(!groceries[0]?.assignee, `rule 4 must not push Drako onto grocery: ${JSON.stringify(groceries)}`);
}

{
  const leaked = validateAct(
    { groceryName: 'Milk', assignee: 'Drako', write: 'add_grocery' },
    'grocery_add'
  );
  assert.equal(leaked.ok, true);
}

// A3d — fuzzy catalog / roster
const diches = resolvePoppinsChoreTitle('diches');
assert.match(diches.title, /dish/i);
assert.equal(diches.provisional === true || Boolean(diches.libraryTaskId), true);
const laundry = resolvePoppinsChoreTitle('lawndry');
assert.match(laundry.title, /laundr/i);
assert.equal(matchAssigneeName('for Draco tomorrow', ['Drako', 'Maya']), 'Drako');

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

const kitchen = parseHouseholdIntent('Add a task for kitchen tomorrow');
assert.equal(kitchen[0]?.type, 'create_task_draft');
assert.ok(!kitchen[0]?.title, 'generic add-a-task must not fake a title');

const intent = parseHouseholdIntent(garbled);
assert.equal(intent[0]?.title, 'Wash the car');
assert.equal(intent[0]?.libraryTaskId, 'wash_the_car');

const kitchenRewrite = rewriteAiuicActions(
  [{ type: 'create_task_draft', title: 'Add a task for kitchen tomorrow' }],
  'Add a task for kitchen tomorrow'
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
