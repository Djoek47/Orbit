import assert from 'node:assert/strict';

import { isComposeReady, nextComposeStep, withComposeProgress } from './iui-compose';

assert.equal(nextComposeStep({}), 'who');
assert.equal(nextComposeStep({ assignee: 'Alex' }), 'category');
assert.equal(nextComposeStep({ assignee: 'Alex', category: 'kitchen_dining' }), 'task');
assert.equal(
  nextComposeStep({ assignee: 'Alex', category: 'kitchen_dining', title: 'Dishes' }),
  'when'
);
assert.equal(
  nextComposeStep({
    assignee: 'Alex',
    category: 'kitchen_dining',
    title: 'Dishes',
    due: 'Today',
  }),
  'ready'
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
