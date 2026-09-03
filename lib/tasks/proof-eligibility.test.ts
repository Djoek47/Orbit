import assert from 'node:assert/strict';

import { canAdminRequestTaskProof } from '@/lib/tasks/proof-eligibility';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

const sidekick: HouseholdMember = {
  id: 'child-1',
  name: 'Emma',
  role: 'child',
  status: 'active',
  avatar: '👧',
  xp: 0,
  loadShare: 0,
};

const adult: HouseholdMember = {
  id: 'adult-1',
  name: 'Sarah',
  role: 'admin',
  status: 'active',
  avatar: '👩',
  xp: 0,
  loadShare: 0,
};

const completedChore: HouseholdTask = {
  id: 't1',
  title: 'Load dishwasher',
  category: 'kitchen_dining',
  assignee: 'Emma',
  due: 'Today',
  xp: 10,
  repeat: 'None',
  status: 'Completed',
  completedAt: new Date().toISOString(),
  proofRequired: false,
};

const completedHomework: HouseholdTask = {
  ...completedChore,
  id: 't2',
  title: 'Math worksheet',
  category: 'homework_education',
};

assert.equal(canAdminRequestTaskProof(completedChore, sidekick), true);
assert.equal(canAdminRequestTaskProof(completedChore, adult), false);
assert.equal(canAdminRequestTaskProof(completedHomework, sidekick), false);

const stale = {
  ...completedChore,
  completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
};
assert.equal(canAdminRequestTaskProof(stale, sidekick), false);

console.log('proof-eligibility: ok');
