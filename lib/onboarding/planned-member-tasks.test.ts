import assert from 'node:assert/strict';

import { plannedTaskCount, plannedTasksForMember } from '@/lib/onboarding/planned-member-tasks';
import { allLibraryTasks } from '@/lib/tasks/task-library';

const sampleId = allLibraryTasks()[0]?.id;
assert.ok(sampleId, 'task library should expose at least one task');

const member = {
  name: 'Josh',
  plannedTaskLibraryIds: [sampleId!],
};

assert.equal(plannedTaskCount(member), 1);
const tasks = plannedTasksForMember(member, 'weighted');
assert.equal(tasks.length, 1);
assert.equal(tasks[0]?.assignee, 'Josh');

console.log('planned-member-tasks.test.ts ok');
