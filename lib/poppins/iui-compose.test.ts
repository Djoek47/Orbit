import assert from 'node:assert/strict';

import { isComposeReady, nextComposeStep, withComposeProgress } from './iui-compose';

assert.equal(nextComposeStep({}), 'who');
assert.equal(nextComposeStep({ assignee: 'Alex' }), 'category');
assert.equal(nextComposeStep({ assignee: 'Alex', category: 'kitchen_dining' }), 'task');
assert.equal(
  nextComposeStep({ assignee: 'Alex', category: 'kitchen_dining', title: 'Tend to the dishes' }),
  'task',
  'created title stays on the task list so the accent chip is visible'
);
assert.equal(
  nextComposeStep({
    assignee: 'Alex',
    category: 'kitchen_dining',
    title: 'Tend to the dishes',
    due: 'Today',
  }),
  'ready'
);
assert.equal(
  nextComposeStep({
    assignee: 'Alex',
    libraryTaskId: 'load_the_dishwasher',
    title: 'Load the dishwasher',
  }),
  'when'
);
assert.equal(isComposeReady({ assignee: 'Alex', due: 'Today' }), false);
assert.equal(
  withComposeProgress({
    assignee: 'Alex',
    category: 'kitchen_dining',
    libraryTaskId: 'load_the_dishwasher',
    title: 'Load the dishwasher',
    due: 'Tomorrow',
  }).composeReady,
  true
);

console.log('iui-compose: ok');
