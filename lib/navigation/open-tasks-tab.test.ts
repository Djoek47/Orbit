/**
 * Home → Tasks tab href. Empty member params must not be sent (they stall on Home).
 * Run: npx --yes tsx lib/navigation/open-tasks-tab.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isActiveTask, isCompletedTask } from '../tasks/expired-tab';
import { isTasksStatus, tasksTabHref } from './open-tasks-tab';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

{
  assert.equal(tasksTabHref(), '/(tabs)/tasks');
  assert.equal(tasksTabHref({ memberName: '  ' }), '/(tabs)/tasks');
  assert.equal(tasksTabHref().includes('member='), false);
  pass('plain Open tasks has no empty params');
}

{
  assert.equal(tasksTabHref({ memberName: 'Rodri' }), '/(tabs)/tasks?member=Rodri');
  pass('person chip focuses that member');
}

{
  assert.equal(tasksTabHref({ status: 'completed' }), '/(tabs)/tasks?status=completed');
  assert.equal(
    tasksTabHref({ memberName: 'Rodri', status: 'completed' }),
    '/(tabs)/tasks?member=Rodri&status=completed',
  );
  pass('fully done today opens Completed');
}

{
  const dishwasher = { status: 'Completed' } as { status: 'Completed' };
  assert.equal(isActiveTask(dishwasher as never), false);
  assert.equal(isCompletedTask(dishwasher as never), true);
  assert.equal(tasksTabHref({ status: 'completed' }).includes('status=completed'), true);
  pass('a finished today task is visible on Completed, not Active');
}

{
  assert.equal(isTasksStatus('completed'), true);
  assert.equal(isTasksStatus('active'), true);
  assert.equal(isTasksStatus('expired'), true);
  assert.equal(isTasksStatus(''), false);
  assert.equal(isTasksStatus('all'), false);
  pass('status param only accepts Tasks tabs');
}

{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const card = readFileSync(join(root, 'components/orbit/today-tasks-card.tsx'), 'utf8');
  const tasks = readFileSync(join(root, 'app/(tabs)/tasks.tsx'), 'utf8');
  assert.equal(card.includes("member: ''"), false, 'Open tasks must not send an empty member param');
  assert.ok(card.includes("status: complete ? 'completed' : 'active'"));
  assert.ok(card.includes('tasksTabHref'));
  assert.ok(card.includes('<Link'));
  assert.ok(tasks.includes('statusParam'));
  assert.ok(tasks.includes('isTasksStatus'));
  pass('Home Open tasks and Tasks screen stay wired');
}

console.log('\nopen-tasks-tab tests passed');
