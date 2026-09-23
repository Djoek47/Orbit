/**
 * Tour practice chore helpers.
 * Run: npx tsx lib/tour/tour-demo-task.test.ts
 */
import assert from 'node:assert/strict';

import {
  householdHasOpenTourPractice,
  pickTourPracticeAssignee,
  pickTourPracticeLibraryTask,
  TOUR_PRACTICE_TITLE,
} from '@/lib/tour/tour-demo-task';
import type { HouseholdMember } from '@/types/orbit';

const members: HouseholdMember[] = [
  {
    id: 'a1',
    name: 'Sarah',
    role: 'admin',
    status: 'active',
    avatar: '👩',
    xp: 0,
    loadShare: 0,
  },
  {
    id: 'c1',
    name: 'Mike',
    role: 'child',
    status: 'active',
    avatar: '👦',
    xp: 0,
    loadShare: 0,
  },
];

const assignee = pickTourPracticeAssignee(members);
assert.equal(assignee?.name, 'Mike');
assert.equal(pickTourPracticeAssignee(members, 'Sarah')?.name, 'Sarah');

const library = pickTourPracticeLibraryTask();
assert.ok(library);
assert.equal(library?.name, TOUR_PRACTICE_TITLE);

assert.equal(
  householdHasOpenTourPractice([{ title: TOUR_PRACTICE_TITLE, status: 'Pending' }]),
  true
);
assert.equal(
  householdHasOpenTourPractice([{ title: TOUR_PRACTICE_TITLE, status: 'Completed' }]),
  false
);

console.log('tour-demo-task: ok');
