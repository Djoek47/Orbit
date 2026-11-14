/**
 * Home glance uses live facts and the time of day.
 * Run: npx tsx lib/poppins/home-glance.test.ts
 */
import assert from 'node:assert/strict';

import { composeHomeGlance } from '@/lib/poppins/home-glance';
import type { HouseholdTask } from '@/types/orbit';

function task(partial: Partial<HouseholdTask> & Pick<HouseholdTask, 'id' | 'title' | 'status'>): HouseholdTask {
  return {
    assignee: 'Mike',
    category: 'Kitchen',
    due: 'Today',
    xp: 10,
    ...partial,
  } as HouseholdTask;
}

const morning = new Date(2026, 8, 23, 3, 31, 0);
const evening = new Date(2026, 8, 23, 19, 10, 0);

const glance = composeHomeGlance({
  now: morning,
  firstName: 'Mike',
  memberName: 'Mike',
  householdView: true,
  tasks: [
    task({ id: '1', title: 'Help cook dinner', status: 'Completed', completedAt: morning.toISOString() }),
    task({ id: '2', title: 'Wipe the counters', status: 'Completed', completedAt: morning.toISOString() }),
    task({ id: '3', title: 'Feed the dog', status: 'Completed', completedAt: morning.toISOString() }),
    task({ id: '4', title: 'Load the dishwasher', status: 'Pending' }),
  ],
  missingGroceries: [],
  nextEvent: null,
});

assert.match(glance.message, /^Good morning, Mike\./);
assert.match(glance.message, /3 of 4 tasks are done/);
assert.match(glance.message, /Load the dishwasher is still yours/);
assert.match(glance.message, /Poppins/);
assert.doesNotMatch(glance.message, /perfect score/i);
assert.equal(glance.kind, 'morningBrief');

const quiet = composeHomeGlance({
  now: evening,
  firstName: 'Mike',
  memberName: 'Mike',
  householdView: true,
  tasks: [task({ id: '1', title: 'Dishes', status: 'Completed', completedAt: evening.toISOString() })],
  missingGroceries: [],
  nextEvent: null,
});
assert.match(quiet.message, /^Good evening, Mike\./);
assert.match(quiet.message, /Today's tasks are done/);
assert.equal(quiet.kind, 'eveningWrap');

const mine = composeHomeGlance({
  now: morning,
  firstName: 'Liam',
  memberName: 'Liam',
  householdView: false,
  tasks: [
    task({ id: '1', title: 'Load the dishwasher', status: 'Pending', assignee: 'Mike' }),
    task({ id: '2', title: 'Make your bed', status: 'Pending', assignee: 'Liam' }),
  ],
  missingGroceries: [{ name: 'Milk', status: 'Missing' }],
});
assert.match(mine.message, /Make your bed is still yours/);
assert.doesNotMatch(mine.message, /dishwasher/i);

const later = composeHomeGlance({
  now: new Date(2026, 8, 23, 5, 0, 0),
  firstName: 'Mike',
  memberName: 'Mike',
  householdView: true,
  tasks: [task({ id: '4', title: 'Load the dishwasher', status: 'Pending' })],
  missingGroceries: [],
});
assert.notEqual(glance.message, later.message);

const steward = composeHomeGlance({
  now: morning,
  firstName: 'Mike',
  memberName: 'Mike',
  householdView: true,
  speaker: 'Steward',
  tasks: [task({ id: '4', title: 'Load the dishwasher', status: 'Pending' })],
  missingGroceries: [],
});
assert.match(steward.message, /Steward/);
assert.doesNotMatch(steward.message, /Poppins/);

console.log('home-glance.test.ts ok');
