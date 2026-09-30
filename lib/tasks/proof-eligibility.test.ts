import assert from 'node:assert/strict';

import { canAdminRequestTaskProof } from '@/lib/tasks/proof-eligibility';
import { canRequestAnotherProof } from '@/lib/tasks/verification';
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
assert.equal(canAdminRequestTaskProof(completedHomework, sidekick), true);
assert.equal(
  canAdminRequestTaskProof({ ...completedChore, completedAt: undefined }, sidekick),
  true
);
assert.equal(
  canAdminRequestTaskProof({ ...completedChore, verification: 'confirmed' }, sidekick),
  false
);

const stale = {
  ...completedChore,
  completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
};
assert.equal(canAdminRequestTaskProof(stale, sidekick), false);

console.log('proof-eligibility: ok');

// ── The proof loop (WO18) ────────────────────────────────────────────────────
// "That photo doesn't show it done" must be able to happen more than once.
{
  const round = { requestedAt: new Date().toISOString() };

  // A rejected proof is where the loop turns, not where it stops.
  assert.equal(canRequestAnotherProof('rejected', [round]), true, 'ask again after a rejection');
  assert.equal(canRequestAnotherProof('rejected', [round, round, round]), true, 'and again');
  // Confirmed ends it.
  assert.equal(canRequestAnotherProof('confirmed', [round]), false, 'confirmed is the end');
  // A first request on a chore that never needed a photo still works.
  assert.equal(canRequestAnotherProof('not_required', []), true);
  // Waiting on one is not a reason to refuse another nudge.
  assert.equal(canRequestAnotherProof('proof_requested', [round]), true);
}
