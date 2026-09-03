import assert from 'node:assert/strict';

import {
  memberHomeworkProofRequired,
  needsProofOnComplete,
  proofRequiredForHomeworkAssign,
} from '@/lib/tasks/homework-proof';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

const childProofOn: HouseholdMember = {
  id: 'c1',
  name: 'Emma',
  role: 'child',
  status: 'active',
  avatar: '👧',
  xp: 0,
  loadShare: 0,
  homeworkProofRequired: true,
};

const childProofOff: HouseholdMember = {
  ...childProofOn,
  id: 'c2',
  homeworkProofRequired: false,
};

assert.equal(memberHomeworkProofRequired(childProofOn), true);
assert.equal(memberHomeworkProofRequired(childProofOff), false);
assert.equal(proofRequiredForHomeworkAssign('homework_education', childProofOn), true);
assert.equal(proofRequiredForHomeworkAssign('homework_education', childProofOff), false);
assert.equal(proofRequiredForHomeworkAssign('kitchen_dining', childProofOn), false);

const homeworkTask: HouseholdTask = {
  id: 'hw1',
  title: 'Worksheet',
  category: 'homework_education',
  assignee: 'Emma',
  due: 'Today',
  xp: 10,
  repeat: 'None',
  status: 'Pending',
  proofRequired: true,
};

assert.equal(needsProofOnComplete(homeworkTask, childProofOff), false);
assert.equal(needsProofOnComplete(homeworkTask, childProofOn), true);

console.log('homework-proof: ok');
