import assert from 'node:assert/strict';

import { rewardsFromDraftMember } from '@/lib/onboarding/materialize-setup';
import type { DraftMember } from '@/lib/onboarding/setup-draft';
import {
  DEFAULT_REWARD_PACKAGE_ID,
  draftRewardsFromPackage,
  rewardsMatchPackage,
} from '@/lib/rewards/reward-packages';

const starter = draftRewardsFromPackage(DEFAULT_REWARD_PACKAGE_ID);
assert.equal(starter.length, 3, 'starter pack has three rewards');
assert.ok(starter.some((r) => r.presetId === 'preset-dessert'));

const member: DraftMember = {
  id: 'm1',
  name: 'Emma',
  role: 'member',
  taskLibraryIds: [],
  rewards: [],
  allowance: null,
  setupComplete: true,
};

const fallback = rewardsFromDraftMember(member, DEFAULT_REWARD_PACKAGE_ID);
assert.equal(fallback.length, 3, 'materialize falls back to starter pack');
assert.ok(rewardsMatchPackage(starter, DEFAULT_REWARD_PACKAGE_ID));

console.log('reward-packages.test.ts ok');
