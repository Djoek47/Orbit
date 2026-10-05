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

// Per-task flag wins over the member default (Edit / Assign can override).
assert.equal(needsProofOnComplete(homeworkTask, childProofOff), true);
assert.equal(needsProofOnComplete(homeworkTask, childProofOn), true);
assert.equal(
  needsProofOnComplete({ ...homeworkTask, proofRequired: false }, childProofOn),
  false,
  'admin can turn proof off on a homework task'
);
assert.equal(
  needsProofOnComplete({ ...homeworkTask, proofRequired: undefined }, childProofOn),
  true,
  'legacy homework without a flag falls back to member default'
);
assert.equal(
  needsProofOnComplete({ ...homeworkTask, proofRequired: undefined }, childProofOff),
  false
);

console.log('homework-proof: ok');
